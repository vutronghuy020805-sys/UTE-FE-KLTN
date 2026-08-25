export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { Users, BookOpen, FileText, GraduationCap } from "lucide-react";
import { SYSTEM_ROLE_LABELS } from "@/lib/constants";
import type { SystemRole } from "@/types";
import Link from "next/link";
import { FixGvpbStatusButton } from "./fix-gvpb-status-button";
import { FixCommitteeStatusButton } from "./fix-committee-status-button";

// StatCard được render thẳng ở đây - không truyền icon qua props
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "red";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const [allUsers, allTopics, allLogs, activeTerm] = await Promise.all([
    db.users.getAll(),
    db.topics.getAll(),
    db.auditLogs.getAll(),
    db.terms.getActive(),
  ]);

  const byRole = allUsers.reduce(
    (acc, u) => {
      acc[u.system_role] = (acc[u.system_role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const activeUsers = allUsers.filter((u) => u.is_active === "true").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const recentLogs = allLogs
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Quản trị hệ thống</h1>
        <p className="text-sm text-slate-500 mt-1">
          Học kỳ hoạt động:{" "}
          {activeTerm ? (
            `${activeTerm.academic_year} · HK${activeTerm.semester} · Đợt ${activeTerm.batch}`
          ) : (
            <span className="text-red-500">Chưa có học kỳ — hãy tạo ngay</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tổng tài khoản"
          value={allUsers.length}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Đang hoạt động"
          value={activeUsers}
          icon={<Users className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Tổng đề tài"
          value={allTopics.length}
          icon={<BookOpen className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Thao tác hôm nay"
          value={
            allLogs.filter((l) => l.created_at.startsWith(todayStr)).length
          }
          icon={<FileText className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Phân bố tài khoản */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Phân bố tài khoản theo vai trò">
          <div className="space-y-3">
            {(["ADMIN", "DEAN", "LECTURER", "STUDENT"] as SystemRole[]).map(
              (role) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {SYSTEM_ROLE_LABELS[role]}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{
                          width: `${allUsers.length ? ((byRole[role] ?? 0) / allUsers.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 w-6 text-right">
                      {byRole[role] ?? 0}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </Card>

        {/* Quick actions */}
        <Card title="Thao tác nhanh">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Tạo tài khoản",
                href: "/admin/users?action=create",
                Icon: Users,
              },
              {
                label: "Quản lý học kỳ",
                href: "/admin/terms",
                Icon: GraduationCap,
              },
              {
                label: "Nhật ký hệ thống",
                href: "/admin/audit-logs",
                Icon: FileText,
              },
              {
                label: "Xem tất cả đề tài",
                href: "/dean/topics",
                Icon: BookOpen,
              },
            ].map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all"
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bảo trì dữ liệu */}
      <Card title="Bảo trì dữ liệu">
        <div className="space-y-5">
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Quét và sửa các đề tài có điểm GVPB &lt; 5 nhưng status còn đang
              "Đã thông qua phản biện" / "Chờ hội đồng" / "Đang chấm hội đồng".
              Không đụng các đề tài đã qua hội đồng (chỉnh sửa / hoàn tất).
            </p>
            <FixGvpbStatusButton />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 mb-2">
              Quét và đẩy về <code className="text-purple-700">CHO_HOI_DONG</code> các đề tài đã được TBM xếp vào hội đồng (có row trong{" "}
              <code>committee_assignments</code>) nhưng status còn ở pha phản biện
              (<code>DA_CHAM_PHAN_BIEN</code> / <code>CHO_CHAM_PHAN_BIEN</code> / <code>DA_CHAM_HUONG_DAN</code>).
              Không đụng đề tài đã ở pha sau hoặc đã fail.
            </p>
            <FixCommitteeStatusButton />
          </div>
        </div>
      </Card>

      {/* Recent audit logs */}
      <Card title="Nhật ký gần đây">
        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Chưa có hoạt động nào
          </p>
        ) : (
          <div className="space-y-1">
            {recentLogs.map((log) => {
              let meta: Record<string, unknown> = {};
              try {
                meta = JSON.parse(log.metadata_json);
              } catch {}
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{log.action}</span>
                      {" · "}
                      <span className="text-slate-500">
                        {log.entity_type}/{log.entity_id?.slice(0, 8)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100 text-center">
          <Link
            href="/admin/audit-logs"
            className="text-xs text-blue-600 hover:underline"
          >
            Xem toàn bộ nhật ký →
          </Link>
        </div>
      </Card>
    </div>
  );
}
