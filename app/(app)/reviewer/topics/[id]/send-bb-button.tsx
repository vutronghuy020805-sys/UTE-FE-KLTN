"use client";

import { useState } from "react";
import { sendBBGVPBToSecretaryAction } from "@/app/actions/topic.actions";
import { toast } from "@/components/ui/index";
import { Send } from "lucide-react";

export function SendBBToSecretaryButton({ topicId }: { topicId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setLoading(true);
    const res = await sendBBGVPBToSecretaryAction(topicId);
    setLoading(false);

    if (res.success && res.data) {
      toast(`Đã gửi biên bản cho thư ký ${res.data.secretaryName}`, "success");
      setSent(true);
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading || sent}
      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
    >
      <Send className="w-4 h-4" />
      {sent ? "Đã gửi biên bản cho thư ký" : loading ? "Đang gửi..." : "Gửi biên bản cho thư ký"}
    </button>
  );
}
