"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTopicAction } from "@/app/actions/topic.actions";
import { toast } from "@/components/ui/index";

export function DeleteTopicButton({ topicId, title }: { topicId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Xóa đề tài "${title}"?\n\nThao tác này không thể hoàn tác.`)) return;
    setLoading(true);
    const result = await deleteTopicAction(topicId);
    setLoading(false);
    if (result.success) {
      toast("Đã xóa đề tài", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
      title="Xóa đề tài"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
