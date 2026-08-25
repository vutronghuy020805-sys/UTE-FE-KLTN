export const dynamic = 'force-dynamic';

import { Card } from "@/components/ui/index";
import { DRIVE_BY_DEPARTMENT } from "@/lib/drive-config";
import { db } from "@/lib/sheets/client";
import { ExternalLink, FolderOpen, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { CreateFolderButton } from "./create-folder-button";

export default async function AdminDrivePage() {
  // Đọc các folder đã được tạo từ sheet
  let savedFolders: { key: string; url: string; label: string }[] = [];
  try {
    savedFolders = (await db.driveFolders.getAll()) as { key: string; url: string; label: string }[];
  } catch {
    // Sheet chưa tồn tại — hiển thị hướng dẫn
  }

  const savedMap = Object.fromEntries(savedFolders.map((f) => [f.key, f.url]));

  // Tổng số folder, đã tạo bao nhiêu
  const totalFolders = DRIVE_BY_DEPARTMENT.length * 4;
  const createdCount = DRIVE_BY_DEPARTMENT.reduce((sum, dept) => {
    const keys = [
      `${dept.code}_BCTT_DOT1`,
      `${dept.code}_BCTT_DOT2`,
      `${dept.code}_KLTN_DOT1`,
      `${dept.code}_KLTN_DOT2`,
    ];
    return sum + keys.filter((k) => savedMap[k]).length;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Quản lý Google Drive</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tạo và quản lý thư mục lưu trữ BCTT và KLTN theo ngành.
          Folder được tạo trong Drive của service account và share công khai.
        </p>
      </div>

      {/* Trạng thái tổng quan */}
      <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${
        createdCount === totalFolders
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}>
        {createdCount === totalFolders
          ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div>
          <p className="font-medium">
            {createdCount}/{totalFolders} folder đã được tạo
          </p>
          {createdCount < totalFolders && (
            <p className="text-xs mt-0.5">
              Bấm <strong>"Tạo folder"</strong> bên cạnh từng ngành để tạo tự động.
              Folder sẽ xuất hiện trong Drive cá nhân (thư mục gốc được share với service account).
            </p>
          )}
        </div>
      </div>

      {/* Hướng dẫn lần đầu */}
      {savedFolders.length === 0 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1">Cần tạo sheet <code>drive_folders</code> trước</p>
            <ol className="text-xs space-y-1 list-decimal list-inside opacity-90">
              <li>Mở Google Spreadsheet của dự án</li>
              <li>Thêm sheet mới, đặt tên: <strong>drive_folders</strong></li>
              <li>Thêm hàng đầu tiên (headers): <code>key | url | label | created_at</code></li>
              <li>Quay lại trang này và bấm "Tạo folder" cho từng ngành</li>
            </ol>
          </div>
        </div>
      )}

      {/* Danh sách ngành */}
      <div className="space-y-4">
        {DRIVE_BY_DEPARTMENT.map((dept) => {
          const bcttDot1Url = savedMap[`${dept.code}_BCTT_DOT1`];
          const bcttDot2Url = savedMap[`${dept.code}_BCTT_DOT2`];
          const kltnDot1Url = savedMap[`${dept.code}_KLTN_DOT1`];
          const kltnDot2Url = savedMap[`${dept.code}_KLTN_DOT2`];
          const allCreated = !!(bcttDot1Url && bcttDot2Url && kltnDot1Url && kltnDot2Url);

          return (
            <Card
              key={dept.code}
              title={`${dept.name} (${dept.code})`}
              action={
                <CreateFolderButton
                  departmentCode={dept.code}
                  departmentName={dept.name}
                  alreadyCreated={allCreated}
                />
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Báo cáo thực tập (BCTT)
                  </p>
                  <div className="space-y-2">
                    <FolderRow label="BCTT – Đợt 1" url={bcttDot1Url} />
                    <FolderRow label="BCTT – Đợt 2" url={bcttDot2Url} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Khóa luận tốt nghiệp (KLTN)
                  </p>
                  <div className="space-y-2">
                    <FolderRow label="KLTN – Đợt 1" url={kltnDot1Url} />
                    <FolderRow label="KLTN – Đợt 2" url={kltnDot2Url} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">Thêm ngành mới</p>
        <p>
          Mở file <code className="bg-slate-100 px-1 rounded">lib/drive-config.ts</code> và thêm object mới
          vào mảng <code className="bg-slate-100 px-1 rounded">DRIVE_BY_DEPARTMENT</code> với{" "}
          <code className="bg-slate-100 px-1 rounded">name</code> và{" "}
          <code className="bg-slate-100 px-1 rounded">code</code> của ngành. Sau đó bấm "Tạo folder".
        </p>
      </div>
    </div>
  );
}

function FolderRow({ label, url }: { label: string; url?: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      url ? "bg-white border-slate-200" : "bg-slate-50 border-dashed border-slate-300"
    }`}>
      <div className="flex items-center gap-2">
        <FolderOpen className={`w-4 h-4 shrink-0 ${url ? "text-blue-500" : "text-slate-300"}`} />
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
        >
          <ExternalLink className="w-3 h-3" /> Mở Drive
        </a>
      ) : (
        <span className="text-xs text-slate-400">Chưa tạo</span>
      )}
    </div>
  );
}
