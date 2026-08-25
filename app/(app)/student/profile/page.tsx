export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { UserCircle } from "lucide-react";

const TRAINING_SYSTEM_LABELS: Record<string, string> = {
  CLC:      "Chất lượng cao",
  REGULAR:  "Đại trà",
  ADVANCED: "Tiên tiến",
  ALL:      "Tất cả",
};

export default async function StudentProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = await db.users.findById(session.user.id);

  const trainingLabel = user?.training_system
    ? (TRAINING_SYSTEM_LABELS[user.training_system] ?? user.training_system)
    : "—";

  const fields = [
    { label: "Mã số sinh viên", value: user?.student_code || "—" },
    { label: "Email",           value: session.user.email ?? "—" },
    { label: "Khoa",            value: user?.department || "—" },
    { label: "Ngành",           value: user?.major || "—" },
    { label: "Hệ đào tạo",      value: trainingLabel },
    { label: "Vai trò",         value: "Sinh viên" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hồ sơ cá nhân</h1>
        <p className="text-sm text-slate-500 mt-1">Thông tin tài khoản của bạn</p>
      </div>

      <Card title="Thông tin cá nhân">
        <div className="flex items-center gap-5 mb-6">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="w-16 h-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {session.user.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900">{session.user.name}</h2>
            <p className="text-sm text-slate-500">{session.user.email}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
              Đăng nhập qua Google
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {fields.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-slate-400 font-medium mb-0.5">{item.label}</dt>
              <dd className="font-medium text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
        <UserCircle className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
        <p>
          Thông tin cá nhân được quản lý bởi Admin. Liên hệ bộ môn nếu thông tin chưa chính xác.
        </p>
      </div>
    </div>
  );
}
