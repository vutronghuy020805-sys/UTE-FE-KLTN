"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { Search, X, Loader2, Send, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { deleteReminderAction } from "@/app/actions/reminder.actions";
import { triggerSingleReminderAction } from "@/app/actions/cron.actions";
import { EditReminderButton, type Lecturer } from "./reminder-form";

export interface ReminderRow {
  id: string;
  title: string;
  content: string;
  deadline_date: string;
  reminder_dates: string;
  email_list: string;
  sent_dates: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ dateStr }: { dateStr: string }) {
  if (!dateStr) return <span className="text-slate-400 text-xs">Chưa đặt</span>;
  const days = daysUntil(dateStr);
  const label = formatDate(dateStr);
  if (days < 0)
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        {label} (Đã qua)
      </span>
    );
  if (days === 0)
    return (
      <span className="text-xs font-medium text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
        Hôm nay!
      </span>
    );
  if (days <= 3)
    return (
      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        {label} (còn {days}d)
      </span>
    );
  return (
    <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
      {label} (còn {days}d)
    </span>
  );
}

function StatusBadge({ reminder }: { reminder: ReminderRow }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(reminder.deadline_date);
  deadline.setHours(0, 0, 0, 0);

  if (deadline < today) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <AlertCircle className="w-3.5 h-3.5" /> Đã qua hạn
      </span>
    );
  }

  const sentArr = (reminder.sent_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const reminderArr = (reminder.reminder_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const totalScheduled = reminderArr.length;
  const totalSent = sentArr.length;

  if (totalSent === 0 && totalScheduled > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <Clock className="w-3.5 h-3.5" /> Chờ gửi
      </span>
    );
  }
  if (totalSent >= totalScheduled && totalScheduled > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle className="w-3.5 h-3.5" /> Đã gửi hết ({totalSent}/{totalScheduled})
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <Send className="w-3.5 h-3.5" /> Đang gửi ({totalSent}/{totalScheduled})
    </span>
  );
}

const STATUS_OPTS = [
  { value: "", label: "Tất cả" },
  { value: "upcoming", label: "Sắp tới" },
  { value: "past", label: "Đã qua" },
];

export function RemindersTable({ rows, lecturers }: { rows: ReminderRow[]; lecturers: Lecturer[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (statusFilter === "upcoming") {
        const d = new Date(r.deadline_date);
        d.setHours(0, 0, 0, 0);
        if (d < today) return false;
      }
      if (statusFilter === "past") {
        const d = new Date(r.deadline_date);
        d.setHours(0, 0, 0, 0);
        if (d >= today) return false;
      }
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Xóa nhắc hạn "${title}"?`)) return;
    setLoadingId(id);
    const res = await deleteReminderAction(id);
    setLoadingId(null);
    if (res.success) {
      toast("Đã xóa", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  async function handleSendNow(id: string) {
    setLoadingId(id + "-send");
    const res = await triggerSingleReminderAction(id);
    setLoadingId(null);
    if (res.success && res.data) {
      const { emailsSent, log } = res.data;
      if (emailsSent > 0) {
        toast(`Đã gửi ${emailsSent} email thành công!`, "success");
      } else {
        toast(log?.[0] ?? "Không có email nào được gửi (SMTP chưa cấu hình?)", "warning");
      }
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  const hasFilter = search || statusFilter;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1.5">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {rows.length} nhắc hạn
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-400">
            <Send className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            Chưa có nhắc hạn nào. Tạo mới bằng nút phía trên.
          </div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Tiêu đề</Th>
                <Th>Ngày hết hạn</Th>
                <Th>Ngày gửi nhắc</Th>
                <Th>Số email</Th>
                <Th>Trạng thái</Th>
                <Th>Thao tác</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((r) => {
                const reminderDates = (r.reminder_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);
                const sentDates = (r.sent_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);
                const emailCount = (r.email_list ?? "").split(",").filter((e) => e.trim()).length;
                const isLoading = loadingId === r.id || loadingId === r.id + "-send";

                return (
                  <Tr key={r.id}>
                    <Td>
                      <p className="font-medium text-slate-800 min-w-48">{r.title}</p>
                      {r.content && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-xs">{r.content}</p>
                      )}
                    </Td>
                    <Td>
                      <DeadlineBadge dateStr={r.deadline_date} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1 min-w-36">
                        {reminderDates.map((d) => {
                          const isSent = sentDates.includes(d);
                          return (
                            <span
                              key={d}
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isSent
                                  ? "bg-green-100 text-green-700 line-through"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {formatDate(d)}
                            </span>
                          );
                        })}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-sm font-semibold text-slate-700">{emailCount}</span>
                      <span className="text-xs text-slate-400 ml-1">địa chỉ</span>
                    </Td>
                    <Td>
                      <StatusBadge reminder={r} />
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleSendNow(r.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-300"
                        >
                          {loadingId === r.id + "-send" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Gửi ngay
                        </button>
                        <EditReminderButton reminder={r} lecturers={lecturers} />
                        <button
                          onClick={() => handleDelete(r.id, r.title)}
                          disabled={isLoading}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:text-slate-300"
                        >
                          {loadingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Xóa
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
