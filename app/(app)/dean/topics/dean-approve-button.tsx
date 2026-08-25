"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { approveDeanAction } from "@/app/actions/topic.actions";
import { CheckCircle2 } from "lucide-react";

export function DeanApproveButton({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const result = await approveDeanAction(topicId);
    setLoading(false);
    if (result.success) {
      toast("Đã phê duyệt đề tài!", "success");
      setOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-green-600 hover:underline font-medium"
      >
        Phê duyệt
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Phê duyệt đề tài"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button leftIcon={CheckCircle2} onClick={handleApprove} loading={loading}>
              Phê duyệt
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Bạn có chắc muốn phê duyệt đề tài:{" "}
          <span className="font-semibold text-slate-800">"{topicTitle}"</span>?
          Sinh viên sẽ được thông báo và bắt đầu thực hiện.
        </p>
      </Modal>
    </>
  );
}
