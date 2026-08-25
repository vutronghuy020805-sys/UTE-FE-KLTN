"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteCommitteeAction } from "@/app/actions/topic.actions";

export function DeleteCommitteeButton({
  committeeId,
  committeeName,
  topicCount,
}: {
  committeeId: string;
  committeeName: string;
  topicCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCommitteeAction(committeeId);
      if (res.success) {
        router.push("/dean/committees");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Xóa hội đồng
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Xóa hội đồng</h2>
                <p className="text-sm text-slate-500">{committeeName}</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 mb-2">
              Bạn chắc chắn muốn xóa hội đồng này?
            </p>
            {topicCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700 mb-4">
                Hội đồng đang có <strong>{topicCount} đề tài</strong>. Các đề tài này sẽ được trả về trạng thái chờ xếp hội đồng.
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Xóa hội đồng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
