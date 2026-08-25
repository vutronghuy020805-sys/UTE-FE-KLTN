"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { getNotificationsAction, markReadAction, markAllReadAction } from "@/app/actions/notification.actions";
import { formatDateTime } from "@/lib/utils";
import { usePathname } from "next/navigation";

// Breadcrumb labels
const PATH_LABELS: Record<string, string> = {
  dashboard: "Tổng quan",
  topics: "Đề tài",
  register: "Đăng ký đề tài",
  profile: "Hồ sơ",
  students: "Sinh viên",
  pending: "Chờ xác nhận",
  assignments: "Phân công",
  quotas: "Hạn mức",
  users: "Tài khoản",
  terms: "Học kỳ",
  "audit-logs": "Nhật ký",
  summary: "Tổng hợp điểm",
  supervisor: "Hướng dẫn",
  reviewer: "Phản biện",
  council: "Hội đồng",
  dean: "Trưởng khoa",
  admin: "Quản trị",
  student: "Sinh viên",
};

interface Notification {
  id: string;
  title: string;
  content: string;
  is_read: string;
  created_at: string;
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumb = segments.map((s) => PATH_LABELS[s] ?? s).join(" › ");

  async function loadNotifs() {
    const result = await getNotificationsAction();
    if (result.success && result.data) setNotifs(result.data as Notification[]);
  }

  useEffect(() => { loadNotifs(); }, []);

  const unread = notifs.filter((n) => n.is_read !== "true").length;

  async function handleMarkRead(id: string) {
    await markReadAction(id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: "true" } : n));
  }

  async function handleMarkAll() {
    await markAllReadAction();
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: "true" })));
  }

  return (
    <header className="h-16 bg-blue-600 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Breadcrumb */}
      <div>
        <p className="text-sm text-blue-100 capitalize">{breadcrumb || "Tổng quan"}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => { setOpen(!open); if (!open) loadNotifs(); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Bell className="w-5 h-5 text-white" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-semibold text-sm text-slate-800">
                  Thông báo {unread > 0 && <span className="text-blue-600">({unread} mới)</span>}
                </span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Đọc tất cả
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Không có thông báo nào
                  </div>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${n.is_read !== "true" ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${n.is_read !== "true" ? "text-slate-900" : "text-slate-600"}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.content}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                        </div>
                        {n.is_read !== "true" && (
                          <button onClick={() => handleMarkRead(n.id)} className="shrink-0 mt-1">
                            <Check className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-blue-500">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-white leading-none">{session?.user?.name}</p>
            <p className="text-xs text-blue-200 mt-0.5">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
