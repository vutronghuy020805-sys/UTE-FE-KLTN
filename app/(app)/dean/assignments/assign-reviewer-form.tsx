"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Select, Button } from "@/components/ui/index";
import { Input } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { assignReviewerAction, assignCommitteeAction } from "@/app/actions/topic.actions";
import { Users, Search, X } from "lucide-react";

interface LecturerOption { value: string; label: string }

// ─── Combobox tìm kiếm giảng viên ────────────────────────────
export function LecturerCombobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Nhập tên giảng viên...",
}: {
  options: LecturerOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function openDropdown() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function select(opt: LecturerOption) {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  // Cập nhật vị trí khi scroll
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    return () => window.removeEventListener("scroll", update, true);
  }, [open]);

  const dropdown = open && !value && rect ? (
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto"
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400 text-center">Không tìm thấy giảng viên</p>
      ) : (
        filtered.map((opt) => (
          <button
            key={opt.value}
            onMouseDown={() => select(opt)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {opt.label}
          </button>
        ))
      )}
    </div>
  ) : null;

  return (
    <div className="relative">
      {label && <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>}

      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-blue-400 rounded-lg bg-blue-50">
          <span className="flex-1 text-sm font-medium text-slate-800 truncate">{selectedLabel}</span>
          <button onClick={clear} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => { setQuery(e.target.value); openDropdown(); }}
            onFocus={openDropdown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {typeof document !== "undefined" && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}

// ─── Phân công GVPB ──────────────────────────────────────────
export function AssignReviewerForm({
  topicId,
  supervisorId,
  lecturers,
}: {
  topicId: string;
  supervisorId: string;
  lecturers: LecturerOption[];
}) {
  const router = useRouter();
  const [reviewerId, setReviewerId] = useState("");
  const [loading, setLoading] = useState(false);

  // Loại trừ GVHD khỏi danh sách GVPB
  const eligibleLecturers = lecturers.filter((l) => l.value !== supervisorId);

  async function handleSelect(id: string) {
    setReviewerId(id);
    if (!id) return;
    setLoading(true);
    const result = await assignReviewerAction(topicId, id);
    setLoading(false);
    if (result.success) {
      toast("Đã phân công giảng viên phản biện!", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
      setReviewerId("");
    }
  }

  return (
    <div className={`min-w-52 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
      <LecturerCombobox
        options={eligibleLecturers}
        value={reviewerId}
        onChange={handleSelect}
        placeholder="Nhập tên giảng viên..."
      />
    </div>
  );
}

// ─── Phân công Hội đồng ──────────────────────────────────────
export function AssignCommitteeForm({
  topicId,
  lecturers,
}: {
  topicId: string;
  lecturers: LecturerOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    committee_name: "",
    secretary_id: "",
    chair_id: "",
    member_1_id: "",
    member_2_id: "",
  });

  async function handleAssign() {
    if (!form.committee_name.trim()) { toast("Vui lòng nhập tên hội đồng", "error"); return; }
    if (!form.secretary_id) { toast("Vui lòng chọn thư ký", "error"); return; }

    setLoading(true);
    const result = await assignCommitteeAction(topicId, {
      committee_name: form.committee_name,
      secretary_id: form.secretary_id,
      chair_id: form.chair_id || undefined,
      member_1_id: form.member_1_id || undefined,
      member_2_id: form.member_2_id || undefined,
    });
    setLoading(false);

    if (result.success) {
      toast("Đã phân công hội đồng!", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <Input
        label="Tên hội đồng *"
        value={form.committee_name}
        onChange={f("committee_name")}
        placeholder="Ví dụ: Hội đồng KLTN - Đợt 1/2025"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Thư ký hội đồng *"
          value={form.secretary_id}
          onChange={f("secretary_id")}
          options={lecturers}
          placeholder="-- Chọn thư ký --"
        />
        <Select
          label="Chủ tịch hội đồng"
          value={form.chair_id}
          onChange={f("chair_id")}
          options={lecturers}
          placeholder="-- Chọn chủ tịch --"
        />
        <Select
          label="Thành viên 1"
          value={form.member_1_id}
          onChange={f("member_1_id")}
          options={lecturers}
          placeholder="-- Chọn thành viên --"
        />
        <Select
          label="Thành viên 2"
          value={form.member_2_id}
          onChange={f("member_2_id")}
          options={lecturers}
          placeholder="-- Chọn thành viên --"
        />
      </div>
      <Button
        leftIcon={Users}
        onClick={handleAssign}
        loading={loading}
        className="w-full"
      >
        Thành lập hội đồng
      </Button>
    </div>
  );
}
