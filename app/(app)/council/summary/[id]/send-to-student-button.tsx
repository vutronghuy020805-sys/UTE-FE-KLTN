"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { sendBienBanToStudentAction } from "@/app/actions/topic.actions";
import { useRouter } from "next/navigation";

export function SendToStudentButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleSend() {
    startTransition(async () => {
      const res = await sendBienBanToStudentAction(topicId);
      if (res.success) {
        setMessage({ type: "ok", text: res.message ?? "Đã gửi cho sinh viên" });
        router.refresh();
      } else {
        setMessage({ type: "err", text: res.error });
      }
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
        onClick={handleSend}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Gửi biên bản cho sinh viên (yêu cầu chỉnh sửa)
      </button>
    </div>
  );
}
