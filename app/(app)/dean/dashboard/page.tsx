export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Users,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DeanDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [allTopics, allUsers] = await Promise.all([
    db.topics.getAll(),
    db.users.getAll(),
  ]);

  const lecturers = allUsers.filter((u) => ["LECTURER", "DEAN"].includes(u.system_role));
  const students = allUsers.filter((u) => u.system_role === "STUDENT");

  const pending = allTopics.filter((t) => t.current_status === "CHO_TRUONG_KHOA_DUYET");
  const active = allTopics.filter((t) => t.current_status === "DANG_THUC_HIEN");
  const grading = allTopics.filter((t) =>
    ["CHO_CHAM_HUONG_DAN", "CHO_CHAM_PHAN_BIEN", "CHO_HOI_DONG", "DANG_CHAM_HOI_DONG"].includes(t.current_status),
  );
  const completed = allTopics.filter((t) => t.current_status === "HOAN_TAT");
  const needReview = allTopics.filter((t) => t.current_status === "CHO_GVHD_DUYET");

  const stats = [
    { label: "Chờ phê duyệt", value: pending.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Đang thực hiện", value: active.length, icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Đang chấm điểm", value: grading.length, icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
    { label: "Hoàn tất", value: completed.length, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    { label: "Tổng đề tài", value: allTopics.length, icon: BookOpen, color: "text-slate-500", bg: "bg-slate-50" },
    { label: "Sinh viên", value: students.length, icon: Users, color: "text-blue-400", bg: "bg-blue-50" },
    { label: "Giảng viên", value: lecturers.length, icon: Users, color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "GV chờ xác nhận", value: needReview.length, icon: Clock, color: "text-amber-400", bg: "bg-amber-50" },
  ];

  const distribution = [
    { label: "Mới đăng ký / Chờ GVHD", count: allTopics.filter((t) => ["MOI_DANG_KY", "CHO_GVHD_DUYET"].includes(t.current_status)).length, color: "bg-slate-400" },
    { label: "Chờ TBM duyệt", count: pending.length, color: "bg-amber-400" },
    { label: "Đang thực hiện", count: active.length, color: "bg-blue-500" },
    { label: "Đang chấm điểm", count: grading.length, color: "bg-purple-500" },
    { label: "Cần chỉnh sửa", count: allTopics.filter((t) => t.current_status === "CAN_CHINH_SUA").length, color: "bg-orange-400" },
    { label: "Không đạt", count: allTopics.filter((t) => ["KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN"].includes(t.current_status)).length, color: "bg-red-400" },
    { label: "Hoàn tất", count: completed.length, color: "bg-green-500" },
  ];

  const quickLinks = [
    { title: "Quản lý đề tài", desc: "Xem, lọc và phân công toàn bộ đề tài", href: "/dean/topics", color: "border-blue-200 hover:border-blue-400" },
    { title: "Phân công GV", desc: "Phân công phản biện và hội đồng", href: "/dean/assignments", color: "border-purple-200 hover:border-purple-400" },
    { title: "Hạn mức GV", desc: "Quản lý quota theo hệ đào tạo", href: "/dean/quotas", color: "border-green-200 hover:border-green-400" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Dashboard Trưởng bộ môn</h1>
        <p className="text-xs text-slate-500">Xin chào, {session.user.name} · Tổng quan hệ thống</p>
      </div>

      {/* 8 stat cards — 1 hàng */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
            <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold text-slate-800 leading-none">{s.value}</p>
            <p className="text-xs text-slate-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Phân bố + Quick links — 2 cột */}
      <div className="grid grid-cols-3 gap-3">
        <Card title="Phân bố trạng thái đề tài" className="col-span-2">
          <div className="space-y-1.5">
            {distribution.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <p className="text-xs text-slate-600 w-40 shrink-0">{item.label}</p>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${item.color}`}
                    style={{ width: `${allTopics.length ? (item.count / allTopics.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-6 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-2">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block p-3 bg-white rounded-xl border-2 ${item.color} transition-colors`}
            >
              <p className="font-semibold text-sm text-slate-800">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Đề tài chờ phê duyệt */}
      {pending.length > 0 && (
        <Card
          title={`Đề tài chờ phê duyệt (${pending.length})`}
          action={<Link href="/dean/topics" className="text-xs text-blue-600 hover:underline">Xem tất cả →</Link>}
        >
          <p className="text-xs text-slate-500">
            Có <span className="font-semibold text-amber-600">{pending.length}</span> đề tài đang chờ duyệt.{" "}
            <Link href="/dean/topics" className="text-blue-600 hover:underline">Vào trang Quản lý đề tài →</Link>
          </p>
        </Card>
      )}
    </div>
  );
}
