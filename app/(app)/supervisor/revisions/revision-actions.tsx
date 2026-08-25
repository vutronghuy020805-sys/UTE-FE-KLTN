"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Send, X } from "lucide-react";
import {
  approveSupervisorRevisionAction,
  rejectSupervisorRevisionAction,
  resendToChairAction,
} from "@/app/actions/topic.actions";

export function RevisionInlineActions({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    if (!confirm("Xác nhận sinh viên đã hoàn tất chỉnh sửa và gửi cho Chủ tịch HĐ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await approveSupervisorRevisionAction(topicId);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleReject() {
    if (!note.trim()) {
      setError("Vui lòng nhập lý do");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectSupervisorRevisionAction(topicId, note);
      if (res.success) {
        setShowRejectModal(false);
        setNote("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-center">
        <button
          onClick={handleApprove}
          disabled={isPending}
          title="Đồng ý — gửi 2 file cho Chủ tịch HĐ"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Đồng ý
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={isPending}
          title="Không đồng ý — yêu cầu SV nộp lại"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <XCircle className="w-3.5 h-3.5" />
          Không đồng ý
        </button>
      </div>

      {error && !showRejectModal && (
        <p className="text-[11px] text-red-600 mt-1 text-center">{error}</p>
      )}

      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRejectModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Không đồng ý bản chỉnh sửa — Yêu cầu SV nộp lại</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Nêu rõ điểm SV cần chỉnh sửa. SV sẽ <strong>nhận email + thấy nội dung này trên trang trạng thái</strong>, và <strong>phải upload lại bộ tài liệu</strong> (file cũ bị xóa) — quy trình duyệt bắt đầu lại từ đầu.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={14}
              placeholder="Ví dụ:&#10;1. Chương 3 mục 3.2: phần kết quả thực nghiệm chưa rõ, cần bổ sung biểu đồ.&#10;2. Tài liệu tham khảo: thiếu 3 nguồn đã thảo luận trong buổi bảo vệ.&#10;3. Phần Kết luận: chưa nêu được hướng phát triển tiếp theo."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 resize-y leading-relaxed"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRejectModal(false); setNote(""); setError(null); }}
                className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || !note.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RevisionResendAction({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleResend() {
    setMessage(null);
    startTransition(async () => {
      const res = await resendToChairAction(topicId);
      if (res.success) {
        setMessage({ type: "ok", text: "Đã gửi nhắc" });
      } else {
        setMessage({ type: "err", text: res.error });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleResend}
        disabled={isPending}
        title="Gửi nhắc Chủ tịch HĐ"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        Gửi lại CT HĐ
      </button>
      {message && (
        <p className={`text-[10px] ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
