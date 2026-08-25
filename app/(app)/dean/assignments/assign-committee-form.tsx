"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, Button, Input } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { assignCommitteeAction } from "@/app/actions/topic.actions";
import { Users } from "lucide-react";

interface LecturerOption { value: string; label: string }

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
    chair_id: "",
    secretary_id: "",
    member_1_id: "",
    member_2_id: "",
    member_3_id: "",
    member_4_id: "",
    member_5_id: "",
    defense_date: "",
    defense_location: "",
  });

  async function handleAssign() {
    if (!form.committee_name.trim()) { toast("Vui lòng nhập tên hội đồng", "error"); return; }
    if (!form.chair_id) { toast("Vui lòng chọn chủ tịch hội đồng", "error"); return; }
    if (!form.secretary_id) { toast("Vui lòng chọn thư ký hội đồng", "error"); return; }
    setLoading(true);
    const result = await assignCommitteeAction(topicId, {
      committee_name: form.committee_name,
      secretary_id: form.secretary_id,
      chair_id: form.chair_id || undefined,
      member_1_id: form.member_1_id || undefined,
      member_2_id: form.member_2_id || undefined,
      member_3_id: form.member_3_id || undefined,
      member_4_id: form.member_4_id || undefined,
      member_5_id: form.member_5_id || undefined,
      defense_date: form.defense_date || undefined,
      defense_location: form.defense_location || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast("Đã phân công hội đồng!", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <Input label="Tên hội đồng *" value={form.committee_name} onChange={f("committee_name")}
        placeholder="Ví dụ: Hội đồng KLTN - Đợt 1/2025" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Ngày bảo vệ" type="datetime-local" value={form.defense_date} onChange={f("defense_date")} />
        <Input label="Địa điểm bảo vệ" value={form.defense_location} onChange={f("defense_location")}
          placeholder="Ví dụ: Phòng A.101" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Chủ tịch hội đồng *" value={form.chair_id} onChange={f("chair_id")}
          options={lecturers} placeholder="-- Chọn chủ tịch --" />
        <Select label="Thư ký hội đồng *" value={form.secretary_id} onChange={f("secretary_id")}
          options={lecturers} placeholder="-- Chọn thư ký --" />
        <Select label="Thành viên 1" value={form.member_1_id} onChange={f("member_1_id")}
          options={lecturers} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 2" value={form.member_2_id} onChange={f("member_2_id")}
          options={lecturers} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 3" value={form.member_3_id} onChange={f("member_3_id")}
          options={lecturers} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 4" value={form.member_4_id} onChange={f("member_4_id")}
          options={lecturers} placeholder="-- Chọn thành viên --" />
        <Select label="Thành viên 5" value={form.member_5_id} onChange={f("member_5_id")}
          options={lecturers} placeholder="-- Chọn thành viên --" />
      </div>
      <Button leftIcon={Users} onClick={handleAssign} loading={loading} className="w-full">
        Thành lập hội đồng
      </Button>
    </div>
  );
}
