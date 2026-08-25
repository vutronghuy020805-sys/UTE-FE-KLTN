"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Input, Select, Button } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { bulkAssignCommitteeAction } from "@/app/actions/topic.actions";
import { Users, ChevronDown, ChevronUp } from "lucide-react";

interface Topic {
  id: string;
  title: string;
  current_status: string;
  topic_type: string;
  academic_year: string;
  semester: string;
  batch: string;
  student: { full_name: string; student_code?: string } | null;
  supervisor: { full_name: string } | null;
  reviewer: { full_name: string } | null;
}

interface Props {
  topics: Topic[];
  lecturers: { value: string; label: string }[];
}

const emptyForm = {
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
};

export function CommitteeBulkSection({ topics, lecturers }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const allChecked = selected.size === topics.length && topics.length > 0;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(topics.map((t) => t.id)));
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  async function handleBulkAssign() {
    if (selected.size === 0) { toast("Chưa chọn đề tài nào", "error"); return; }
    if (!form.committee_name.trim()) { toast("Vui lòng nhập tên hội đồng", "error"); return; }
    if (!form.secretary_id) { toast("Vui lòng chọn thư ký hội đồng", "error"); return; }
    setLoading(true);
    const result = await bulkAssignCommitteeAction(Array.from(selected), {
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
      toast(result.message ?? "Đã phân công hội đồng!", "success");
      setSelected(new Set());
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  // Nhóm theo đợt
  const batchKeys = Array.from(
    new Set(topics.map((t) => `${t.academic_year}|${t.semester}|${t.batch}`))
  );

  return (
    <div className="space-y-4">
      {/* Panel form hội đồng — hiện khi có sinh viên được chọn */}
      {selected.size > 0 && (
        <div className="border border-blue-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">
                Thành lập hội đồng cho {selected.size} đề tài đã chọn
              </span>
            </div>
            {showForm ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />}
          </button>

          {showForm && (
            <div className="p-4 bg-white space-y-3">
              <Input
                label="Tên hội đồng *"
                value={form.committee_name}
                onChange={f("committee_name")}
                placeholder="Ví dụ: Hội đồng KLTN - Đợt 1/2025"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ngày bảo vệ" type="datetime-local" value={form.defense_date} onChange={f("defense_date")} />
                <Input label="Địa điểm bảo vệ" value={form.defense_location} onChange={f("defense_location")} placeholder="Ví dụ: Phòng A.101" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Chủ tịch hội đồng" value={form.chair_id} onChange={f("chair_id")} options={lecturers} placeholder="-- Chọn chủ tịch --" />
                <Select label="Thư ký hội đồng *" value={form.secretary_id} onChange={f("secretary_id")} options={lecturers} placeholder="-- Chọn thư ký --" />
                <Select label="Thành viên 1" value={form.member_1_id} onChange={f("member_1_id")} options={lecturers} placeholder="-- Chọn thành viên --" />
                <Select label="Thành viên 2" value={form.member_2_id} onChange={f("member_2_id")} options={lecturers} placeholder="-- Chọn thành viên --" />
                <Select label="Thành viên 3" value={form.member_3_id} onChange={f("member_3_id")} options={lecturers} placeholder="-- Chọn thành viên --" />
                <Select label="Thành viên 4" value={form.member_4_id} onChange={f("member_4_id")} options={lecturers} placeholder="-- Chọn thành viên --" />
                <Select label="Thành viên 5" value={form.member_5_id} onChange={f("member_5_id")} options={lecturers} placeholder="-- Chọn thành viên --" />
              </div>
              <div className="flex gap-3">
                <Button leftIcon={Users} onClick={handleBulkAssign} loading={loading} className="flex-1">
                  Thành lập hội đồng cho {selected.size} đề tài
                </Button>
                <button
                  onClick={() => { setSelected(new Set()); setShowForm(false); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danh sách đề tài theo đợt */}
      {batchKeys.map((key) => {
        const [ay, sem, bat] = key.split("|");
        const batchTopics = topics.filter(
          (t) => t.academic_year === ay && t.semester === sem && t.batch === bat
        );
        const batchSelected = batchTopics.filter((t) => selected.has(t.id)).length;
        const batchAllChecked = batchSelected === batchTopics.length;

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={batchAllChecked}
                onChange={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    batchTopics.forEach((t) => batchAllChecked ? next.delete(t.id) : next.add(t.id));
                    return next;
                  });
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
              />
              <h3 className="text-sm font-medium text-slate-500">
                {ay} · HK{sem} · Đợt {bat}
                <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {batchTopics.length} chờ
                </span>
                {batchSelected > 0 && (
                  <span className="ml-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    {batchSelected} đã chọn
                  </span>
                )}
              </h3>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {batchTopics.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                    selected.has(t.id) ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 mt-0.5 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-xs text-slate-500">
                        SV: {t.student?.full_name}{t.student?.student_code ? ` (${t.student.student_code})` : ""}
                      </span>
                      <span className="text-xs text-slate-500">GVHD: {t.supervisor?.full_name ?? "—"}</span>
                      <span className="text-xs text-slate-500">GVPB: {t.reviewer?.full_name ?? "—"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.topic_type === "KLTN" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>{t.topic_type}</span>
                    </div>
                  </div>
                  <TopicStatusBadge status={t.current_status} type="KLTN" />
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {/* Nút chọn tất cả ở cuối nếu nhiều đợt */}
      {topics.length > 0 && (
        <div className="flex items-center gap-3 pt-1">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
          />
          <span className="text-sm text-slate-500">
            {allChecked ? "Bỏ chọn tất cả" : `Chọn tất cả ${topics.length} đề tài`}
          </span>
        </div>
      )}
    </div>
  );
}
