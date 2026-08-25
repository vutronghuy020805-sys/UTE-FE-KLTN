"use client";

import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/domain/file-upload";
import { FileText, ExternalLink } from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/utils";
import type { UploadedFile } from "@/types";

interface BienBanUploadProps {
  topicId: string;
  existingFiles: UploadedFile[];
}

export function BienBanUpload({ topicId, existingFiles }: BienBanUploadProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-700">
        Upload biên bản họp hội đồng để sinh viên có thể tải về và nộp kèm bản chỉnh sửa.
      </div>

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Đã upload ({existingFiles.length})
          </p>
          {existingFiles.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}
                  </p>
                </div>
              </div>
              <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                <ExternalLink className="w-3.5 h-3.5" /> Xem
              </a>
            </div>
          ))}
        </div>
      )}

      <FileUpload
        topicId={topicId}
        fileType="BIEN_BAN_HOI_DONG"
        label="Upload biên bản hội đồng"
        accept=".pdf,.doc,.docx"
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
