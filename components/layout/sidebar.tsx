"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Star,
  LogOut, ChevronRight, UserCircle,
  GraduationCap, Award, FileText, BarChart3, FolderOpen,
  Crown, Info, HelpCircle, Lightbulb, PieChart, Bell, Settings,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SYSTEM_ROLE_LABELS } from "@/lib/constants";
import type { SystemRole } from "@/types";

interface NavItem { href: string; label: string; icon: React.ElementType }

const LECTURER_NAV: NavItem[] = [
  { href: "/supervisor/students",    label: "Sinh viên hướng dẫn", icon: Users },
  { href: "/supervisor/revisions",   label: "Xét chỉnh sửa SV",    icon: ClipboardCheck },
  { href: "/reviewer/dashboard",     label: "Phản biện của tôi",   icon: Star },
  { href: "/council/dashboard",      label: "Hội đồng của tôi",    icon: Award },
  { href: "/council/chair",          label: "Chủ tịch hội đồng",   icon: Crown },
  { href: "/council/summary",        label: "Tổng hợp (Thư ký)",   icon: BarChart3 },
  { href: "/supervisor/info",        label: "Thông tin chung",      icon: Info },
  { href: "/supervisor/guide",       label: "Hướng dẫn",            icon: HelpCircle },
  { href: "/supervisor/suggestions", label: "Gợi ý đề tài",        icon: Lightbulb },
];

const TBM_DEAN_NAV: NavItem[] = [
  { href: "/dean/dashboard",   label: "Tổng quan (TBM)",     icon: LayoutDashboard },
  { href: "/dean/topics",      label: "Quản lý đề tài",      icon: BookOpen },
  { href: "/dean/quotas",      label: "Hạn mức giảng viên",  icon: Users },
  { href: "/dean/assignments", label: "Phân công GVPB",      icon: ClipboardList },
  { href: "/dean/committees",  label: "Phân công hội đồng",  icon: Award },
  { href: "/dean/statistics",   label: "Tải biên bản hội đồng", icon: PieChart },
  { href: "/dean/post-defense", label: "Theo dõi sau bảo vệ",   icon: BarChart3 },
  { href: "/dean/reminders",   label: "Nhắc hạn",            icon: Bell },
  { href: "/dean/settings",    label: "Cài đặt",             icon: Settings },
];

const NAV_BY_ROLE: Record<SystemRole, NavItem[]> = {
  STUDENT: [
    { href: "/student/profile",         label: "Hồ sơ cá nhân",       icon: UserCircle },
    { href: "/student/topics/register", label: "Đăng ký đề tài",      icon: ClipboardList },
    { href: "/student/status",          label: "Theo dõi trạng thái", icon: BarChart3 },
  ],
  LECTURER: LECTURER_NAV,
  DEAN: LECTURER_NAV, // DEAN always sees combined nav (rendered separately below)
  ADMIN: [
    { href: "/admin/dashboard",  label: "Tổng quan",        icon: LayoutDashboard },
    { href: "/admin/users",      label: "Tài khoản",        icon: Users },
    { href: "/admin/terms",      label: "Học kỳ / Đợt",     icon: GraduationCap },
    { href: "/admin/drive",      label: "Google Drive",     icon: FolderOpen },
    { href: "/admin/audit-logs", label: "Nhật ký hệ thống", icon: FileText },
  ],
};

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = pathname === item.href || (item.href.split("/").length > 2 && pathname.startsWith(item.href));
  return (
    <Link key={item.href} href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        isActive ? "bg-white/20 text-white" : "text-blue-100 hover:bg-blue-600 hover:text-white"
      )}>
      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-blue-300")} />
      <span className="truncate">{item.label}</span>
      {isActive && <ChevronRight className="w-3 h-3 ml-auto text-white/70" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  if (!session?.user) return null;
  const role = session.user.system_role;
  const showCombinedNav = role === "DEAN";
  const roleLabel = SYSTEM_ROLE_LABELS[role];

  return (
    <aside className="w-64 h-screen bg-blue-700 flex flex-col fixed left-0 top-0 z-40">
      <div className="h-16 flex items-center px-6 border-b border-blue-600">
        <div className="flex items-center gap-2.5">
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b9/Logo_Tr%C6%B0%E1%BB%9Dng_%C4%90%E1%BA%A1i_H%E1%BB%8Dc_S%C6%B0_Ph%E1%BA%A1m_K%E1%BB%B9_Thu%E1%BA%ADt_TP_H%E1%BB%93_Ch%C3%AD_Minh.png" alt="Logo" className="w-10 h-10 object-contain bg-white rounded-full p-1" />
          <div>
            <p className="text-sm font-bold text-white leading-none">KLTN</p>
            <p className="text-[10px] text-blue-300 leading-none mt-0.5">Quản lý khóa luận</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-blue-600">
        <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">{roleLabel}</p>
        <p className="text-sm font-medium text-white mt-0.5 truncate">{session.user.name}</p>
        <p className="text-xs text-blue-300 truncate">{session.user.email}</p>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {showCombinedNav ? (
          <>
            <div className="space-y-0.5">
              {LECTURER_NAV.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
            </div>
            <div className="my-3 flex items-center gap-2 px-1">
              <div className="flex-1 h-px bg-blue-600" />
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">Trưởng Bộ Môn</span>
              <div className="flex-1 h-px bg-blue-600" />
            </div>
            <div className="space-y-0.5">
              {TBM_DEAN_NAV.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
            </div>
          </>
        ) : (
          <div className="space-y-0.5">
            {(NAV_BY_ROLE[role] ?? []).map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
          </div>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-blue-600">
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-blue-600 hover:text-red-200 transition-all">
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
