"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { createReminderAction, updateReminderAction } from "@/app/actions/reminder.actions";
import { PlusCircle, Pencil, Wand2, X, Search, UserPlus, Users, CheckCheck } from "lucide-react";

export interface Lecturer {
  id: string;
  name: string;
  email: string;
}

interface ReminderRow {
  id: string;
  title: string;
  content: string;
  deadline_date: string;
  reminder_dates: string;
  email_list: string;
}

const EMPTY_FORM = {
  title: "",
  content: "",
  deadline_date: "",
  reminder_dates: "",
  email_list: "",
};

function autoFillReminderDates(deadline: string): string {
  if (!deadline) return "";
  return [7, 5, 3, 2, 1]
    .map((offset) => {
      const d = new Date(deadline);
      d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
    .join(", ");
}

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* ─── Email picker from system users ─────────────────────────── */
function LecturerPicker({
  lecturers,
  selectedEmails,
  onToggle,
  onSelectAll,
}: {
  lecturers: Lecturer[];
  selectedEmails: string[];
  onToggle: (email: string) => void;
  onSelectAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return lecturers;
    return lecturers.filter(
      (l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
    );
  }, [lecturers, query]);

  const allSelected = lecturers.every((l) => selectedEmails.includes(l.email));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Chọn từ hệ thống ({lecturers.length} GV)
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Select all */}
          <button
            type="button"
            onClick={onSelectAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-b border-slate-100 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {allSelected ? "Bỏ chọn tất cả" : `Chọn tất cả (${lecturers.length})`}
          </button>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Không tìm thấy</p>
            ) : (
              filtered.map((l) => {
                const selected = selectedEmails.includes(l.email);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onToggle(l.email)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${selected ? "bg-blue-50" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                      {selected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{l.name}</p>
                      <p className="text-xs text-slate-400 truncate">{l.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              Đã chọn <span className="font-semibold text-slate-600">{selectedEmails.filter(e => lecturers.some(l => l.email === e)).length}</span> / {lecturers.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Create Button ────────────────────────────────────────────── */
export function CreateReminderButton({ lecturers }: { lecturers: Lecturer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate() {
    if (!form.title || !form.deadline_date || !form.reminder_dates || !form.email_list) {
      toast("Vui lòng điền đầy đủ các trường bắt buộc (*)", "error");
      return;
    }
    setLoading(true);
    const res = await createReminderAction(form);
    setLoading(false);
    if (res.success) {
      toast("Đã tạo nhắc hạn!", "success");
      setOpen(false);
      setForm(EMPTY_FORM);
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <>
      <Button leftIcon={PlusCircle} onClick={() => setOpen(true)}>
        Tạo nhắc hạn mới
      </Button>
      <ReminderModal
        open={open}
        onClose={() => { setOpen(false); setForm(EMPTY_FORM); }}
        form={form}
        set={set}
        onSubmit={handleCreate}
        loading={loading}
        title="Tạo nhắc hạn mới"
        submitLabel="Tạo"
        lecturers={lecturers}
      />
    </>
  );
}

/* ─── Edit Button ─────────────────────────────────────────────── */
export function EditReminderButton({ reminder, lecturers }: { reminder: ReminderRow; lecturers: Lecturer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setFormState] = useState(EMPTY_FORM);

  function openEdit() {
    setFormState({
      title: reminder.title,
      content: reminder.content,
      deadline_date: reminder.deadline_date,
      reminder_dates: reminder.reminder_dates,
      email_list: reminder.email_list,
    });
    setOpen(true);
  }

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setFormState((f) => ({ ...f, [field]: value }));
  }

  async function handleUpdate() {
    if (!form.title || !form.deadline_date || !form.reminder_dates || !form.email_list) {
      toast("Vui lòng điền đầy đủ các trường bắt buộc (*)", "error");
      return;
    }
    setLoading(true);
    const res = await updateReminderAction(reminder.id, form);
    setLoading(false);
    if (res.success) {
      toast("Đã cập nhật!", "success");
      setOpen(false);
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <>
      <button
        onClick={openEdit}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium"
      >
        <Pencil className="w-3.5 h-3.5" /> Sửa
      </button>
      <ReminderModal
        open={open}
        onClose={() => setOpen(false)}
        form={form}
        set={set}
        onSubmit={handleUpdate}
        loading={loading}
        title="Chỉnh sửa nhắc hạn"
        submitLabel="Lưu"
        lecturers={lecturers}
      />
    </>
  );
}

/* ─── Shared Modal ────────────────────────────────────────────── */
function ReminderModal({
  open, onClose, form, set, onSubmit, loading, title, submitLabel, lecturers,
}: {
  open: boolean;
  onClose: () => void;
  form: typeof EMPTY_FORM;
  set: (field: keyof typeof EMPTY_FORM, value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  title: string;
  submitLabel: string;
  lecturers: Lecturer[];
}) {
  const emailArr = useMemo(
    () => form.email_list.split(",").map((e) => e.trim()).filter(Boolean),
    [form.email_list],
  );

  const reminderDatesArr = useMemo(
    () => form.reminder_dates.split(",").map((d) => d.trim()).filter(Boolean),
    [form.reminder_dates],
  );

  function toggleEmail(email: string) {
    const arr = emailArr.includes(email)
      ? emailArr.filter((e) => e !== email)
      : [...emailArr, email];
    set("email_list", arr.join(", "));
  }

  function toggleAllLecturers() {
    const allSelected = lecturers.every((l) => emailArr.includes(l.email));
    if (allSelected) {
      // Bỏ chọn tất cả GV (giữ lại email nhập tay không có trong DS GV)
      const nonLecturerEmails = emailArr.filter((e) => !lecturers.some((l) => l.email === e));
      set("email_list", nonLecturerEmails.join(", "));
    } else {
      const allEmails = [...new Set([...emailArr, ...lecturers.map((l) => l.email)])];
      set("email_list", allEmails.join(", "));
    }
  }

  function removeEmail(email: string) {
    set("email_list", emailArr.filter((e) => e !== email).join(", "));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={onSubmit} loading={loading}>{submitLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tiêu đề */}
        <Input
          label="Tiêu đề thông báo *"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="vd: Nhắc hạn nộp KLTN HK1 2025-2026"
        />

        {/* Ngày deadline */}
        <Input
          label="Ngày hết hạn *"
          type="date"
          value={form.deadline_date}
          onChange={(e) => set("deadline_date", e.target.value)}
        />

        {/* Ngày nhắc */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Ngày gửi nhắc * <span className="text-slate-400 font-normal">(cách nhau bởi dấu phẩy)</span>
            </label>
            <button
              type="button"
              onClick={() => set("reminder_dates", autoFillReminderDates(form.deadline_date))}
              disabled={!form.deadline_date}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-300"
            >
              <Wand2 className="w-3 h-3" /> Tự động (7/5/3/2/1 ngày trước)
            </button>
          </div>
          <input
            type="text"
            value={form.reminder_dates}
            onChange={(e) => set("reminder_dates", e.target.value)}
            placeholder="2026-05-01, 2026-05-03, 2026-05-05"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {reminderDatesArr.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {reminderDatesArr.map((d) => (
                <span key={d} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                  {formatDateDisplay(d)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Danh sách email */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Danh sách người nhận *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{emailArr.length} địa chỉ</span>
              <LecturerPicker
                lecturers={lecturers}
                selectedEmails={emailArr}
                onToggle={toggleEmail}
                onSelectAll={toggleAllLecturers}
              />
            </div>
          </div>

          {/* Email badges */}
          {emailArr.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg max-h-28 overflow-y-auto">
              {emailArr.map((email) => {
                const lecturer = lecturers.find((l) => l.email === email);
                return (
                  <span
                    key={email}
                    className="flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-200 px-2 py-1 rounded-full shadow-sm"
                    title={email}
                  >
                    {lecturer ? (
                      <span className="font-medium text-slate-800">{lecturer.name}</span>
                    ) : (
                      <span>{email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="hover:text-red-500 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Manual email input */}
          <div className="flex gap-2">
            <ManualEmailInput onAdd={(email) => {
              if (!emailArr.includes(email)) {
                set("email_list", [...emailArr, email].join(", "));
              }
            }} />
          </div>
          <p className="text-xs text-slate-400">
            Chọn từ hệ thống hoặc nhập email bên ngoài bằng ô bên dưới
          </p>
        </div>

        {/* Nội dung (tuỳ chọn) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Nội dung email{" "}
            <span className="text-slate-400 font-normal">(tuỳ chọn — để trống hệ thống tự tạo)</span>
          </label>
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            rows={3}
            placeholder="Kính gửi quý thầy/cô, ..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ─── Manual email input ──────────────────────────────────────── */
function ManualEmailInput({ onAdd }: { onAdd: (email: string) => void }) {
  const [value, setValue] = useState("");

  function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    // Hỗ trợ paste nhiều email cách nhau bởi dấu phẩy/xuống dòng
    const emails = trimmed.split(/[,\n]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    emails.forEach(onAdd);
    setValue("");
  }

  return (
    <div className="flex gap-2 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        placeholder="Nhập email hoặc dán nhiều email..."
        className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        + Thêm
      </button>
    </div>
  );
}
