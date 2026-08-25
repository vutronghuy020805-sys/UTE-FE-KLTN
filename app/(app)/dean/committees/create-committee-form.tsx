"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Input, Select, Button } from "@/components/ui/index";
import { createCommitteeAction } from "@/app/actions/topic.actions";
import { Users, ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** GV cùng ngành của TBM — dùng cho Chủ tịch và Thành viên HĐ */
  lecturers: { value: string; label: string }[];
  /** Tất cả GV — dùng cho Thư ký (không yêu cầu cùng ngành) */
  secretaryLecturers: { value: string; label: string }[];
  /** key = "YYYY-MM-DD|SESSION" → [lecturerId,...] */
  usedGvByDateSession: Record<string, string[]>;
}

const emptyForm = {
  committee_name: "",
  defense_date: "",
  defense_session: "MORNING",
  defense_location: "",
  chair_id: "",
  secretary_id: "",
  member_1_id: "",
  member_2_id: "",
  member_3_id: "",
};

// ── Searchable select (combobox) ─────────────────────────────────────────────
interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "-- Chọn --",
  required,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={ref} className={cn("space-y-1.5 relative", className)}>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        onClick={() => !open && setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2 border rounded-lg text-sm cursor-text bg-white transition-all",
          open
            ? "border-blue-500 ring-2 ring-blue-500/30"
            : "border-slate-300 hover:border-blue-400",
        )}
      >
        {open ? (
          <>
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selected?.label ?? "Gõ để tìm..."}
              className="flex-1 outline-none bg-transparent text-sm min-w-0"
            />
          </>
        ) : (
          <>
            <span className={cn("flex-1 truncate", selected ? "text-slate-800" : "text-slate-400")} title={selected?.label}>
              {selected?.label ?? placeholder}
            </span>
            {selected && !required && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="shrink-0 text-slate-400 hover:text-red-500"
                title="Bỏ chọn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 italic">Không có kết quả</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left truncate transition-colors",
                  o.value === value ? "bg-blue-50 font-medium text-blue-700" : "",
                  o.disabled
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:bg-slate-50",
                )}
                title={o.label}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CreateCommitteeForm({ lecturers, secretaryLecturers, usedGvByDateSession }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const selectedDate = form.defense_date;
  const selectedSession = form.defense_session;

  const busyIds = useMemo(() => {
    if (!selectedDate) return new Set<string>();
    const key = `${selectedDate}|${selectedSession}`;
    return new Set(usedGvByDateSession[key] ?? []);
  }, [selectedDate, selectedSession, usedGvByDateSession]);

  const selectedInForm = useMemo(() => new Set([
    form.chair_id, form.secretary_id,
    form.member_1_id, form.member_2_id, form.member_3_id,
  ].filter(Boolean)), [form]);

  function filterOptions(currentKey: keyof typeof form) {
    const source = currentKey === "secretary_id" ? secretaryLecturers : lecturers;
    return source.map((l) => {
      const busyOtherCommittee = busyIds.has(l.value);
      const usedInForm = selectedInForm.has(l.value) && form[currentKey] !== l.value;
      if (busyOtherCommittee) {
        return { ...l, label: `${l.label} (bận ngày này)`, disabled: true };
      }
      if (usedInForm) {
        return { ...l, label: `${l.label} (đã chọn)`, disabled: true };
      }
      return l;
    });
  }

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const setKey = (key: keyof typeof form) => (val: string) => setForm({ ...form, [key]: val });

  async function handleSubmit() {
    if (!form.committee_name.trim()) { toast("Vui lòng nhập tên hội đồng", "error"); return; }
    if (!form.defense_date) { toast("Vui lòng chọn ngày bảo vệ", "error"); return; }
    if (!form.secretary_id) { toast("Vui lòng chọn thư ký hội đồng", "error"); return; }

    setLoading(true);
    const result = await createCommitteeAction({
      committee_name: form.committee_name,
      defense_date: form.defense_date,
      defense_session: form.defense_session || undefined,
      defense_location: form.defense_location || undefined,
      chair_id: form.chair_id || undefined,
      secretary_id: form.secretary_id,
      member_1_id: form.member_1_id || undefined,
      member_2_id: form.member_2_id || undefined,
      member_3_id: form.member_3_id || undefined,
    });
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Đã tạo hội đồng!", "success");
      setForm(emptyForm);
      router.push(`/dean/committees/${result.data?.committeeId}`);
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Top row: 4 field gọn ngang */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Input
            label="Tên hội đồng *"
            value={form.committee_name}
            onChange={f("committee_name")}
            placeholder="Hội đồng KLTN 1"
          />
        </div>
        <div className="w-40">
          <Input
            label="Địa điểm bảo vệ"
            value={form.defense_location}
            onChange={f("defense_location")}
            placeholder="Phòng A.101"
          />
        </div>
        <div className="w-40">
          <Input
            label="Ngày bảo vệ *"
            type="date"
            value={form.defense_date}
            onChange={f("defense_date")}
          />
        </div>
        <div className="w-28">
          <Select
            label="Buổi *"
            value={form.defense_session}
            onChange={f("defense_session")}
            options={[
              { value: "MORNING", label: "Sáng" },
              { value: "AFTERNOON", label: "Chiều" },
            ]}
          />
        </div>
      </div>

      {selectedDate && busyIds.size > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Ngày {selectedDate} ({selectedSession === "MORNING" ? "sáng" : "chiều"}): có {busyIds.size} GV đã được phân công vào hội đồng khác cùng buổi (đánh dấu trong danh sách). GV làm buổi khác không bị chặn.
        </p>
      )}

      {/* Chair + Secretary + Members — searchable */}
      <div className="flex flex-wrap gap-3">
        <SearchableSelect
          label="Chủ tịch hội đồng"
          value={form.chair_id}
          onChange={setKey("chair_id")}
          options={filterOptions("chair_id")}
          placeholder="-- Chọn chủ tịch --"
          className="w-72"
        />
        <SearchableSelect
          label="Thư ký hội đồng"
          required
          value={form.secretary_id}
          onChange={setKey("secretary_id")}
          options={filterOptions("secretary_id")}
          placeholder="-- Chọn thư ký --"
          className="w-72"
        />
        <SearchableSelect
          label="Thành viên 1"
          value={form.member_1_id}
          onChange={setKey("member_1_id")}
          options={filterOptions("member_1_id")}
          placeholder="-- Chọn thành viên --"
          className="w-72"
        />
        <SearchableSelect
          label="Thành viên 2"
          value={form.member_2_id}
          onChange={setKey("member_2_id")}
          options={filterOptions("member_2_id")}
          placeholder="-- Chọn thành viên --"
          className="w-72"
        />
        <SearchableSelect
          label="Thành viên 3"
          value={form.member_3_id}
          onChange={setKey("member_3_id")}
          options={filterOptions("member_3_id")}
          placeholder="-- Chọn thành viên --"
          className="w-72"
        />
      </div>

      <Button leftIcon={Users} onClick={handleSubmit} loading={loading} className="w-full">
        Tạo hội đồng & thêm sinh viên
      </Button>
    </div>
  );
}
