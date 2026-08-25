"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { FileUpload } from "@/components/domain/file-upload";
import { SubmitRevisionButton } from "./submit-revision-button";

interface Props {
  topicId: string;
  initialHasChinhSua: boolean;
  initialHasGiaiTrinh: boolean;
  /** True khi SV đã bấm 'Gửi' rồi (status CHO_GVHD_XAC_NHAN/CHO_CHU_TICH_DUYET/CHO_THU_KY_XAC_NHAN).
   *  Cho phép upload lại (đè file) nhưng ẩn nút 'Gửi'. */
  alreadySubmitted?: boolean;
}

export function RevisionUploadSection({
  topicId,
  initialHasChinhSua,
  initialHasGiaiTrinh,
  alreadySubmitted = false,
}: Props) {
  const [hasChinhSua, setHasChinhSua] = useState(initialHasChinhSua);
  const [hasGiaiTrinh, setHasGiaiTrinh] = useState(initialHasGiaiTrinh);

  const bothUploaded = hasChinhSua && hasGiaiTrinh;

  return (
    <div className="space-y-5">
      {alreadySubmitted ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <p className="font-medium mb-1">Bạn đã gửi tài liệu chỉnh sửa cho GVHD.</p>
          <p className="text-xs opacity-90">
            Nếu cần sửa nhầm file, bạn có thể upload lại — file mới sẽ tự động ghi đè file cũ. GVHD/Chủ tịch sẽ chỉ thấy file mới nhất, KHÔNG cần bấm "Gửi" lại.
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <p className="font-medium mb-1">Yêu cầu nộp 2 tài liệu:</p>
          <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
            <li><strong>File 1:</strong> KLTN đã chỉnh sửa (PDF hoặc Word)</li>
            <li><strong>File 2:</strong> Biên bản giải trình — ghi rõ đã sửa chỗ nào, trang mấy</li>
          </ul>
          <p className="text-xs mt-2 font-medium">Sau khi upload đủ 2 file, nhấn "Gửi cho GVHD".</p>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700">File 1: KLTN đã chỉnh sửa</p>
        <FileUpload
          topicId={topicId}
          fileType="CHINH_SUA"
          label="KLTN đã chỉnh sửa"
          accept=".pdf,.doc,.docx"
          onSuccess={() => setHasChinhSua(true)}
        />
        {hasChinhSua && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Đã upload file KLTN chỉnh sửa
          </div>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700">File 2: Biên bản giải trình</p>
        <p className="text-xs text-slate-500 mb-2">
          Ghi rõ từng điểm đã sửa: nội dung sửa, trang số, đoạn văn cụ thể.
        </p>
        <FileUpload
          topicId={topicId}
          fileType="PHIEU_GIAI_TRINH"
          label="Biên bản giải trình chỉnh sửa"
          accept=".pdf,.doc,.docx"
          onSuccess={() => setHasGiaiTrinh(true)}
        />
        {hasGiaiTrinh && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Đã upload biên bản giải trình
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100">
        {alreadySubmitted ? (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Đã gửi cho GVHD — đang chờ duyệt. File mới upload sẽ tự động cập nhật.
          </div>
        ) : bothUploaded ? (
          <SubmitRevisionButton topicId={topicId} />
        ) : (
          <p className="text-xs text-slate-400 text-center italic">
            Upload đủ 2 file để kích hoạt nút gửi.
          </p>
        )}
      </div>
    </div>
  );
}
