"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { FileUpload } from "@/components/domain/file-upload";
import { useRouter } from "next/navigation";

interface Props {
  topicId: string;
  hasBaoCao: boolean;
  hasXacNhan: boolean;
  mssv: string;
  major: string;
}

function CopyFilename({ filename }: { filename: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(filename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <p className="text-xs text-slate-600">
      Tên file:{" "}
      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1 font-mono font-semibold px-1 py-0.5 rounded transition-colors ${
          copied ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
        }`}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {filename}
      </button>
    </p>
  );
}

export function BcttUploadSection({ topicId, hasBaoCao, hasXacNhan, mssv, major }: Props) {
  const router = useRouter();
  const [uploadedBaoCao, setUploadedBaoCao] = useState(hasBaoCao);
  const [uploadedXacNhan, setUploadedXacNhan] = useState(hasXacNhan);

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 flex flex-wrap gap-x-4">
        <span><strong>File 1:</strong> Báo cáo thực tập (PDF, tối đa 5MB)</span>
        <span><strong>File 2:</strong> Phiếu xác nhận từ công ty (PDF, có đóng dấu, tối đa 5MB)</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* File 1 */}
        <div className="border border-slate-200 rounded-xl p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">File 1: Báo cáo thực tập</p>
          {mssv && <CopyFilename filename={`${mssv}_${major}_BCTT`} />}
          {uploadedBaoCao ? (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Đã nộp
            </div>
          ) : (
            <FileUpload
              topicId={topicId}
              fileType="BAO_CAO"
              accept=".pdf"
              maxSizeMB={5}
              onSuccess={() => { setUploadedBaoCao(true); router.refresh(); }}
            />
          )}
        </div>

        {/* File 2 */}
        <div className="border border-slate-200 rounded-xl p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">File 2: Phiếu xác nhận thực tập</p>
          {mssv && <CopyFilename filename={`${mssv}_PXN_${major}`} />}
          {uploadedXacNhan ? (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Đã nộp
            </div>
          ) : (
            <FileUpload
              topicId={topicId}
              fileType="XAC_NHAN"
              accept=".pdf"
              maxSizeMB={5}
              onSuccess={() => { setUploadedXacNhan(true); router.refresh(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
