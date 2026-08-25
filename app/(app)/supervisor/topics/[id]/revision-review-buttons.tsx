"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import {
  approveSupervisorRevisionAction,
  rejectSupervisorRevisionAction,
  resendToChairAction,
} from "@/app/actions/topic.actions";

export function ResendToChairButton({ topicId }: { topicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleResend() {
    startTransition(async () => {
      const res = await resendToChairAction(topicId);
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
        <p className="text-sm rounded-lg px-3 py-2 border text-red-600 bg-red-50 border-red-200">
          {message.text}
        </p>
      )}
      <button
        onClick={handleResend}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Gửi lại cho Chủ tịch hội đồng
      </button>
    </div>
  );
}

export function RevisionReviewButtons({ topicId }: { topicId: string }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const res = await approveSupervisorRevisionAction(topicId);
      setMessage({ type: res.success ? "ok" : "err", text: res.success ? (res.message ?? "") : res.error });
    });
  }

  function handleReject() {
    if (!note.trim()) {
      setMessage({ type: "err", text: "Vui lòng nhập lý do từ chối" });
      return;
    }
    startTransition(async () => {
      const res = await rejectSupervisorRevisionAction(topicId, note);
      setMessage({ type: res.success ? "ok" : "err", text: res.success ? (res.message ?? "") : res.error });
      if (res.success) setRejectMode(false);
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
    <div className="space-y-3">
      {message?.type === "err" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {message.text}
        </p>
      )}

      {!rejectMode ? (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Đồng ý — Đã hoàn tất chỉnh sửa
          </button>
          <button
            onClick={() => setRejectMode(true)}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Không đồng ý
          </button>
        </div>
      ) : (
        <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-medium text-red-800">Lý do không đồng ý (SV sẽ nhận email + thấy trên trang trạng thái, file cũ bị xóa, SV phải upload lại):</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={10}
            placeholder="Nêu rõ điểm cần chỉnh sửa lại..."
            className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white resize-y leading-relaxed"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending || !note.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Gửi yêu cầu
            </button>
            <button
              onClick={() => { setRejectMode(false); setNote(""); setMessage(null); }}
              className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
