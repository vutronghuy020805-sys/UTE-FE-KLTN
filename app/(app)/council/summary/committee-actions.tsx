"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, toast } from "@/components/ui/index";
import { confirmScoresAndSendBbhdAction } from "@/app/actions/topic.actions";
import { Download, Send } from "lucide-react";

interface Props {
  committeeId: string;
  committeeName: string;
  sampleTopicId: string;
  totalTopics: number;
}

export function CommitteeActions({
  committeeId,
  committeeName,
  sampleTopicId,
  totalTopics,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await confirmScoresAndSendBbhdAction(committeeId);
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã gửi", "success");
      setOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {committeeName || "Hội đồng không tên"}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{totalTopics} đề tài</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/download/excel-hd/${sampleTopicId}`}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Tải file Excel điểm
        </a>

        <Button
          size="sm"
          leftIcon={Send}
          variant="primary"
          onClick={() => setOpen(true)}
        >
          Xác nhận điểm và gửi BBHD
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Xác nhận điểm và gửi Biên bản hội đồng"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Hủy
            </Button>
            <Button onClick={handleConfirm} loading={loading} leftIcon={Send}>
              Gửi đồng loạt
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            Hệ thống sẽ gửi Biên bản hội đồng kèm điểm tổng kết (Final) cho <b>{totalTopics}</b> sinh viên trong hội đồng <b>{committeeName}</b>.
          </p>
          <p className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">
            Lưu ý: Chỉ những đề tài đã được bấm "Lưu Biên Bản" (có file BBHD) mới được gửi. Đề tài chưa lưu sẽ bị bỏ qua.
          </p>
        </div>
      </Modal>
    </div>
  );
}
