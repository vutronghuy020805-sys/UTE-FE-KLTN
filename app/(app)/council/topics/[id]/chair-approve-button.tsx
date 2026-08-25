"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle, X } from "lucide-react";
import { approveChairFinalAction, finalizeTopicAction, rejectChairRevisionAction } from "@/app/actions/topic.actions";

export function ChairApproveButton({ topicId }: { topicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const res = await approveChairFinalAction(topicId);
      setMessage({ type: res.success ? "ok" : "err", text: res.success ? (res.message ?? "") : res.error });
    });
  }

  if (message?.type === "ok") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        {message.text}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message?.type === "err" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {message.text}
        </p>
      )}
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        Phê duyệt hoàn tất quy trình KLTN
      </button>
    </div>
  );
}

export function ChairRejectButton({ topicId }: { topicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function handleReject() {
    if (!note.trim()) {
      setMessage({ type: "err", text: "Vui lòng nhập lý do từ chối" });
      return;
    }
    startTransition(async () => {
      const res = await rejectChairRevisionAction(topicId, note.trim());
      setMessage({ type: res.success ? "ok" : "err", text: res.success ? (res.message ?? "") : res.error });
      if (res.success) {
        setOpen(false);
        setNote("");
      }
    });
  }

  if (message?.type === "ok") {
    return (
      <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <XCircle className="w-4 h-4 shrink-0" />
        {message.text}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
      >
        <XCircle className="w-4 h-4" />
        Không đồng ý — yêu cầu SV nộp lại
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); setMessage(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                Không đồng ý bản chỉnh sửa — Yêu cầu SV nộp lại
              </h3>
              <button
                onClick={() => { setOpen(false); setMessage(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Nêu rõ điểm SV cần chỉnh sửa. SV sẽ <strong>nhận email + thấy nội dung này trên trang trạng thái</strong>, và <strong>phải upload lại bộ tài liệu</strong> (file cũ bị xóa) — quy trình duyệt bắt đầu lại từ GVHD.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={14}
              placeholder="VD:&#10;1. Phần 2.3 chưa đúng yêu cầu, cần bổ sung trích dẫn.&#10;2. Chương 4: chưa cập nhật số liệu mới theo yêu cầu HĐ.&#10;3. Tài liệu tham khảo: thiếu 5 nguồn quan trọng."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 resize-y leading-relaxed"
            />
            {message?.type === "err" && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {message.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setOpen(false); setNote(""); setMessage(null); }}
                disabled={isPending}
                className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || !note.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <XCircle className="w-4 h-4" />
                Xác nhận không đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ChairFinalizeButton({ topicId }: { topicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleFinalize() {
    startTransition(async () => {
      const res = await finalizeTopicAction(topicId);
      setMessage({ type: res.success ? "ok" : "err", text: res.success ? (res.message ?? "") : res.error });
    });
  }

  if (message?.type === "ok") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        {message.text}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message?.type === "err" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {message.text}
        </p>
      )}
      <button
        onClick={handleFinalize}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        Xác nhận hoàn tất quy trình KLTN
      </button>
    </div>
  );
}
