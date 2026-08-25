export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card, Table, Thead, Tbody, Th, Td, Tr, EmptyState } from "@/components/ui/index";
import { Users } from "lucide-react";
import { SYSTEM_ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { UserActionsMenu, CreateUserButton } from "./user-actions-menu";
import type { SystemRole } from "@/types";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const { role, q } = await searchParams;

  let users = await db.users.getAll();

  if (role) users = users.filter((u) => u.system_role === role);
  if (q) {
    const query = q.toLowerCase();
    users = users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.student_code?.toLowerCase() ?? "").includes(query)
    );
  }

  users.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const roleFilter = [
    { value: "", label: "Tất cả vai trò" },
    { value: "ADMIN", label: "Quản trị viên" },
    { value: "DEAN", label: "Trưởng bộ môn" },
    { value: "LECTURER", label: "Giảng viên" },
    { value: "STUDENT", label: "Sinh viên" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1">Tổng: {users.length} tài khoản</p>
        </div>
        <CreateUserButton />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        {roleFilter.map((opt) => (
          <a
            key={opt.value}
            href={opt.value ? `/admin/users?role=${opt.value}` : "/admin/users"}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              role === opt.value || (!role && !opt.value)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {opt.label}
          </a>
        ))}
        <form method="GET" action="/admin/users" className="ml-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm kiếm tên, email, MSSV..."
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </form>
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState icon={<Users className="w-7 h-7 text-slate-400" />} title="Không có tài khoản nào" description="Thử thay đổi bộ lọc hoặc tạo tài khoản mới" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Họ và tên</Th>
                <Th>Email</Th>
                <Th>Vai trò</Th>
                <Th>MSSV / Khoa</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày tạo</Th>
                <Th>Thao tác</Th>
              </tr>
            </Thead>
            <Tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center shrink-0">
                        {u.full_name[0]?.toUpperCase()}
                      </div>
                      <p className="font-medium text-slate-800">{u.full_name}</p>
                    </div>
                  </Td>
                  <Td><p className="text-slate-600">{u.email}</p></Td>
                  <Td>
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-medium">
                      {SYSTEM_ROLE_LABELS[u.system_role as SystemRole]}
                    </span>
                  </Td>
                  <Td>
                    <p className="text-slate-600">{u.student_code || "—"}</p>
                    <p className="text-xs text-slate-400">{u.department || "—"}</p>
                  </Td>
                  <Td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.is_active === "true"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {u.is_active === "true" ? "Hoạt động" : "Vô hiệu"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                  </Td>
                  <Td>
                    <UserActionsMenu userId={u.id} isActive={u.is_active === "true"} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
