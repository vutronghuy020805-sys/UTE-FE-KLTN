"use client";

import { useState } from "react";
import { Button } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { approveChairFinalAction } from "@/app/actions/topic.actions";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export function ChairApproveButton({ topicId }: { topicId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleApprove() {
    if (!confirm("Xác nhận phê duyệt hoàn tất quy trình KLTN cho đề tài này?")) return;
    setLoading(true);
    const result = await approveChairFinalAction(topicId);
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã phê duyệt hoàn tất", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <Button
      size="sm"
      leftIcon={CheckCircle2}
      loading={loading}
      onClick={handleApprove}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      Phê duyệt
    </Button>
  );
}
