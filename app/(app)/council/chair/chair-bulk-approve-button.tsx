"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { approveChairFinalAction, finalizeTopicAction } from "@/app/actions/topic.actions";
import { useRouter } from "next/navigation";

interface Props {
  topicIds: string[];
}

export function ChairBulkApproveButton({ topicIds }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  function handleApproveAll() {
    startTransition(async () => {
      const errs: string[] = [];
      let count = 0;
      for (const id of topicIds) {
        const res = await approveChairFinalAction(id);
        if (res.success) {
          count++;
          setDone(count);
        } else {
          errs.push(res.error);
        }
      }
      setErrors(errs);
      setFinished(true);
      router.refresh();
    });
  }

  if (finished) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Đã phê duyệt {done}/{topicIds.length} đề tài
        {errors.length > 0 && (
          <span className="text-red-600 ml-2">· {errors.length} lỗi</span>
        )}
      </div>
    );
  }

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <ShieldCheck className="w-4 h-4" />
        Phê duyệt hàng loạt ({topicIds.length})
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">Xác nhận phê duyệt {topicIds.length} đề tài?</span>
      <button
        onClick={handleApproveAll}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang duyệt {done}/{topicIds.length}...</>
        ) : (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận</>
        )}
      </button>
      <button
        onClick={() => setConfirmed(false)}
        disabled={isPending}
        className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
      >
        Huỷ
      </button>
    </div>
  );
}

// ── Xác nhận hoàn tất từng topic (inline) ────────────────────────────────────
export function ChairFinalizeInlineButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleFinalize() {
    startTransition(async () => {
      const res = await finalizeTopicAction(topicId);
      if (res.success) { setDone(true); router.refresh(); }
    });
  }

  if (done) return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất
    </span>
  );

  return (
    <button
      onClick={handleFinalize}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
      Xác nhận hoàn tất
    </button>
  );
}

// ── Xác nhận hoàn tất hàng loạt ──────────────────────────────────────────────
export function ChairBulkFinalizeButton({ topicIds }: { topicIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);

  function handleFinalizeAll() {
    startTransition(async () => {
      let count = 0;
      for (const id of topicIds) {
        const res = await finalizeTopicAction(id);
        if (res.success) { count++; setDone(count); }
      }
      setFinished(true);
      router.refresh();
    });
  }

  if (finished) return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      Đã xác nhận {done}/{topicIds.length} đề tài
    </div>
  );

  if (!confirmed) return (
    <button
      onClick={() => setConfirmed(true)}
      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      <ShieldCheck className="w-4 h-4" />
      Xác nhận hàng loạt ({topicIds.length})
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">Xác nhận hoàn tất {topicIds.length} đề tài?</span>
      <button
        onClick={handleFinalizeAll}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xác nhận {done}/{topicIds.length}...</>
        ) : (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận</>
        )}
      </button>
      <button onClick={() => setConfirmed(false)} disabled={isPending}
        className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
        Huỷ
      </button>
    </div>
  );
}
