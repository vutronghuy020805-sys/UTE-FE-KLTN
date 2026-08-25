"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast, Input, Select, Button } from "@/components/ui/index";
import { updateCommitteeAction } from "@/app/actions/topic.actions";
import { Pencil, X, Check } from "lucide-react";

interface Props {
  committeeId: string;
  initial: {
    committee_name: string;
    defense_date: string;
    defense_session: string;
    defense_location: string;
    chair_id: string;
    secretary_id: string;
    member_1_id: string;
    member_2_id: string;
    member_3_id: string;
    member_4_id: string;
    member_5_id: string;
  };
  /** GV cùng ngành — cho chủ tịch + thành viên */
  lecturers: { value: string; label: string }[];
  /** Tất cả GV — cho thư ký (không cần cùng ngành) */
  secretaryLecturers: { value: string; label: string }[];
  /** key = "YYYY-MM-DD|SESSION" → [lecturerId,...] */
  usedGvByDateSession: Record<string, string[]>;
}

export function EditCommitteeForm({ committeeId, initial, lecturers, secretaryLecturers, usedGvByDateSession }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  const selectedDate = form.defense_date;
  const selectedSession = form.defense_session;

  // GV đã bận (ngày + buổi) đó ở HĐ KHÁC
  const busyIds = useMemo(() => {
    if (!selectedDate) return new Set<string>();
    const key = `${selectedDate}|${selectedSession}`;
    const usedOnSlot = usedGvByDateSession[key] ?? [];
    // Loại trừ các GV đang trong chính HĐ này
    const currentMembers = new Set([
      initial.chair_id, initial.secretary_id,
      initial.member_1_id, initial.member_2_id, initial.member_3_id,
      initial.member_4_id, initial.member_5_id,
    ].filter(Boolean));
    return new Set(usedOnSlot.filter((id) => !currentMembers.has(id)));
  }, [selectedDate, selectedSession, usedGvByDateSession, initial]);

  const selectedInForm = useMemo(() => new Set([
    form.chair_id, form.secretary_id,
    form.member_1_id, form.member_2_id, form.member_3_id,
    form.member_4_id, form.member_5_id,
  ].filter(Boolean)), [form]);

  function filterOptions(currentKey: string) {
    // Thư ký dùng danh sách đầy đủ; các vai trò khác dùng danh sách cùng ngành
    const source = currentKey === "secretary_id" ? secretaryLecturers : lecturers;
    return source.map((l) => {
      const busyOther = busyIds.has(l.value);
      const usedInForm = selectedInForm.has(l.value) && form[currentKey as keyof typeof form] !== l.value;
      if (busyOther) return { ...l, label: `${l.label} (bận ngày này)`, disabled: true };
      if (usedInForm) return { ...l, label: `${l.label} (đã chọn)`, disabled: true };
      return l;
    });
  }

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  function handleCancel() {
    setForm(initial);
    setEditing(false);
  }

  async function handleSave() {
    if (!form.committee_name.trim()) { toast("Vui lòng nhập tên hội đồng", "error"); return; }
    if (!form.secretary_id) { toast("Vui lòng chọn thư ký hội đồng", "error"); return; }
    setLoading(true);
    const result = await updateCommitteeAction(committeeId, {
      committee_name: form.committee_name,
      defense_date: form.defense_date,
      defense_session: form.defense_session || undefined,
      defense_location: form.defense_location || undefined,
      chair_id: form.chair_id || undefined,
      secretary_id: form.secretary_id,
      member_1_id: form.member_1_id || undefined,
      member_2_id: form.member_2_id || undefined,
      member_3_id: form.member_3_id || undefined,
      member_4_id: form.member_4_id || undefined,
      member_5_id: form.member_5_id || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã cập nhật!", "success");
      setEditing(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Chỉnh sửa
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input label="Tên hội đồng *" value={form.committee_name} onChange={f("committee_name")} />
        </div>
        <Input label="Ngày bảo vệ *" type="date" value={form.defense_date} onChange={f("defense_date")} />
        <Select
          label="Buổi *"
          value={form.defense_session}
          onChange={f("defense_session")}
          options={[
            { value: "MORNING", label: "Sáng" },
            { value: "AFTERNOON", label: "Chiều" },
          ]}
        />
        <div className="col-span-2">
          <Input label="Địa điểm" value={form.defense_location} onChange={f("defense_location")} placeholder="Ví dụ: Phòng A.101" />
        </div>
      </div>

      {selectedDate && busyIds.size > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Ngày {selectedDate} ({selectedSession === "MORNING" ? "sáng" : "chiều"}): {busyIds.size} GV đã được phân công vào hội đồng khác cùng buổi.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Chủ tịch" value={form.chair_id} onChange={f("chair_id")} options={filterOptions("chair_id")} placeholder="-- Chọn chủ tịch --" />
        <Select label="Thư ký *" value={form.secretary_id} onChange={f("secretary_id")} options={filterOptions("secretary_id")} placeholder="-- Chọn thư ký --" />
        <Select label="Thành viên 1" value={form.member_1_id} onChange={f("member_1_id")} options={filterOptions("member_1_id")} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 2" value={form.member_2_id} onChange={f("member_2_id")} options={filterOptions("member_2_id")} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 3" value={form.member_3_id} onChange={f("member_3_id")} options={filterOptions("member_3_id")} placeholder="-- Chọn thành viên --" />
      </div>

      <div className="flex gap-2">
        <Button leftIcon={Check} onClick={handleSave} loading={loading} className="flex-1">
          Lưu thay đổi
        </Button>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
        >
          <X className="w-3.5 h-3.5" /> Hủy
        </button>
      </div>
    </div>
  );
}
