"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { submitRevisionForReviewAction } from "@/app/actions/topic.actions";

export function SubmitRevisionButton({ topicId }: { topicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitRevisionForReviewAction(topicId);
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
        onClick={handleSubmit}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full justify-center"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Gửi tài liệu chỉnh sửa cho GVHD
      </button>
    </div>
  );
}
