"use client";

import { useState } from "react";
import { Button, Modal, Textarea } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { approveSupervisorAction, rejectSupervisorAction } from "@/app/actions/topic.actions";
import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function ApproveRejectButtons({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handleApprove() {
    setLoading("approve");
    const result = await approveSupervisorAction(topicId);
    setLoading(null);
    if (result.success) {
      toast(result.message ?? "Đã xác nhận", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleReject() {
    if (!reason.trim()) { toast("Vui lòng nhập lý do từ chối", "error"); return; }
    setLoading("reject");
    const result = await rejectSupervisorAction(topicId, reason);
    setLoading(null);
    if (result.success) {
      toast("Đã từ chối", "success");
      setRejectOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="primary"
          leftIcon={CheckCircle2}
          loading={loading === "approve"}
          onClick={handleApprove}
        >
          Đồng ý
        </Button>
        <Button
          size="sm"
          variant="danger"
          leftIcon={XCircle}
          loading={loading === "reject"}
          onClick={() => setRejectOpen(true)}
        >
          Từ chối
        </Button>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối hướng dẫn"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleReject} loading={loading === "reject"}>
              Xác nhận từ chối
            </Button>
          </>
        }
      >
        <Textarea
          label="Lý do từ chối *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Nhập lý do từ chối để thông báo cho sinh viên..."
        />
      </Modal>
    </>
  );
}
