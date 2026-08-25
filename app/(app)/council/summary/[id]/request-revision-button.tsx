"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Textarea } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { requestRevisionAction } from "@/app/actions/topic.actions";
import { MessageSquare } from "lucide-react";

export function RequestRevisionButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  async function handleRequest() {
    if (!note.trim()) { toast("Vui lòng nhập nội dung yêu cầu", "error"); return; }
    setLoading(true);
    const result = await requestRevisionAction(topicId, note);
    setLoading(false);
    if (result.success) {
      toast("Đã gửi yêu cầu chỉnh sửa", "success");
      setOpen(false);
      setNote("");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <Button variant="outline" leftIcon={MessageSquare} onClick={() => setOpen(true)}>
        Yêu cầu chỉnh sửa
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Yêu cầu sinh viên chỉnh sửa" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={handleRequest} loading={loading}>Gửi yêu cầu</Button>
          </>
        }
      >
        <Textarea label="Nội dung yêu cầu *" value={note}
          onChange={(e) => setNote(e.target.value)} rows={4}
          placeholder="Mô tả cụ thể những điểm cần chỉnh sửa..." />
      </Modal>
    </>
  );
}
