export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card, Table, Thead, Tbody, Th, Td, Tr, EmptyState } from "@/components/ui/index";
import { FileText } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  REGISTER_TOPIC:       { label: "Đăng ký đề tài", color: "bg-blue-100 text-blue-700" },
  APPROVE_SUPERVISION:  { label: "GVHD đồng ý", color: "bg-green-100 text-green-700" },
  REJECT_SUPERVISION:   { label: "GVHD từ chối", color: "bg-red-100 text-red-700" },
  APPROVE_TOPIC_DEAN:   { label: "TK phê duyệt", color: "bg-green-100 text-green-700" },
  SUBMIT_SCORE_SUPERVISOR:     { label: "Chấm điểm GVHD", color: "bg-purple-100 text-purple-700" },
  SUBMIT_SCORE_REVIEWER:       { label: "Chấm điểm GVPB", color: "bg-purple-100 text-purple-700" },
  SUBMIT_SCORE_COMMITTEE_MEMBER: { label: "Chấm điểm HĐ", color: "bg-purple-100 text-purple-700" },
  ASSIGN_REVIEWER:      { label: "Phân công GVPB", color: "bg-indigo-100 text-indigo-700" },
  ASSIGN_COMMITTEE:     { label: "Phân công HĐ", color: "bg-indigo-100 text-indigo-700" },
  REQUEST_REVISION:     { label: "Yêu cầu chỉnh sửa", color: "bg-orange-100 text-orange-700" },
  FINALIZE_TOPIC:       { label: "Hoàn tất", color: "bg-green-100 text-green-700" },
  UPLOAD_FILE:          { label: "Upload file", color: "bg-slate-100 text-slate-600" },
  CREATE_USER:          { label: "Tạo tài khoản", color: "bg-blue-100 text-blue-700" },
  UPDATE_USER:          { label: "Cập nhật TK", color: "bg-slate-100 text-slate-600" },
  ACTIVATE_USER:        { label: "Kích hoạt TK", color: "bg-green-100 text-green-700" },
  DEACTIVATE_USER:      { label: "Vô hiệu TK", color: "bg-red-100 text-red-700" },
  RESET_PASSWORD:       { label: "Đặt lại MK", color: "bg-amber-100 text-amber-700" },
  CHANGE_PASSWORD:      { label: "Đổi mật khẩu", color: "bg-slate-100 text-slate-600" },
  UPDATE_QUOTA:         { label: "Cập nhật quota", color: "bg-slate-100 text-slate-600" },
  CREATE_TERM:          { label: "Tạo học kỳ", color: "bg-blue-100 text-blue-700" },
  SET_ACTIVE_TERM:      { label: "Kích hoạt học kỳ", color: "bg-green-100 text-green-700" },
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const { action, page } = await searchParams;
  const currentPage = parseInt(page ?? "1");
  const pageSize = 50;

  let logs = await db.auditLogs.getAll();
  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (action) logs = logs.filter((l) => l.action === action);

  const total = logs.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Lấy tên user cho từng log
  const logsWithUser = await Promise.all(
    paginatedLogs.map(async (log) => {
      const user = log.user_id ? await db.users.findById(log.user_id) : null;
      let meta: Record<string, unknown> = {};
      try { meta = JSON.parse(log.metadata_json); } catch {}
      return { ...log, userName: user?.full_name ?? "System", meta };
    })
  );

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhật ký hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng: {total} thao tác{action ? ` (đang lọc: ${action})` : ""}
          </p>
        </div>
      </div>

      {/* Filter by action */}
      <div className="flex gap-2 flex-wrap">
        <a
          href="/admin/audit-logs"
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !action ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          Tất cả
        </a>
        {uniqueActions.slice(0, 12).map((act) => {
          const info = ACTION_LABELS[act];
          return (
            <a
              key={act}
              href={`/admin/audit-logs?action=${act}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                action === act ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {info?.label ?? act}
            </a>
          );
        })}
      </div>

      <Card>
        {logsWithUser.length === 0 ? (
          <EmptyState icon={<FileText className="w-7 h-7 text-slate-400" />} title="Không có nhật ký nào" description="Chưa có thao tác nào được ghi lại" />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Người dùng</Th>
                  <Th>Thao tác</Th>
                  <Th>Đối tượng</Th>
                  <Th>Chi tiết</Th>
                </tr>
              </Thead>
              <Tbody>
                {logsWithUser.map((log) => {
                  const info = ACTION_LABELS[log.action];
                  return (
                    <Tr key={log.id}>
                      <Td>
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </p>
                      </Td>
                      <Td>
                        <p className="text-sm font-medium text-slate-800">{log.userName}</p>
                      </Td>
                      <Td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info?.color ?? "bg-slate-100 text-slate-600"}`}>
                          {info?.label ?? log.action}
                        </span>
                      </Td>
                      <Td>
                        <p className="text-xs text-slate-500 font-mono">
                          {log.entity_type}/{log.entity_id?.slice(0, 12)}
                        </p>
                      </Td>
                      <Td>
                        <p className="text-xs text-slate-400 max-w-xs truncate font-mono">
                          {Object.keys(log.meta).length > 0
                            ? JSON.stringify(log.meta).slice(0, 60)
                            : "—"}
                        </p>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Trang {currentPage}/{totalPages} · {total} bản ghi
                </p>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <a
                      href={`/admin/audit-logs?${action ? `action=${action}&` : ""}page=${currentPage - 1}`}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      ← Trước
                    </a>
                  )}
                  {currentPage < totalPages && (
                    <a
                      href={`/admin/audit-logs?${action ? `action=${action}&` : ""}page=${currentPage + 1}`}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Tiếp →
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
