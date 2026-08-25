"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { toast } from "@/components/ui/index";
import { Search, X, Pencil, ChevronDown } from "lucide-react";
import { LecturerCombobox } from "./assign-reviewer-form";
import { reassignReviewerAction, bulkAssignReviewerAction } from "@/app/actions/topic.actions";

interface AssignedTopic {
  id: string;
  title: string;
  current_status: string;
  topic_type: string;
  academic_year: string;
  semester: string;
  batch: string;
  supervisor_id: string;
  student: { full_name: string; student_code: string } | null;
  supervisor: { full_name: string } | null;
  reviewer: { id: string; full_name: string } | null;
  gvhdFailed?: boolean;
}

interface Props {
  topics: AssignedTopic[];
  reviewers: { id: string; full_name: string }[];
  lecturers: { value: string; label: string }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "TRẠNG THÁI" },
  { value: "DANG_THUC_HIEN", label: "Đang thực hiện" },
  { value: "CHO_CHAM_HUONG_DAN", label: "Chờ GVHD chấm" },
  { value: "DA_CHAM_HUONG_DAN", label: "Qua GVHD" },
  { value: "CHO_CHAM_PHAN_BIEN", label: "Chờ phản biện" },
  { value: "DA_CHAM_PHAN_BIEN", label: "Qua phản biện" },
];

export function AssignedTopicsFilterTable({ topics, reviewers, lecturers }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [gvpbFilter, setGvpbFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (statusFilter && t.current_status !== statusFilter) return false;
      if (gvpbFilter && t.reviewer?.id !== gvpbFilter) return false;
      if (q) {
        const inName = t.student?.full_name.toLowerCase().includes(q) ?? false;
        const inCode = t.student?.student_code.toLowerCase().includes(q) ?? false;
        const inTitle = t.title.toLowerCase().includes(q);
        if (!inName && !inCode && !inTitle) return false;
      }
      return true;
    });
  }, [topics, search, statusFilter, gvpbFilter]);

  const allChecked = selected.size === filtered.length && filtered.length > 0;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map((t) => t.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleBulkSave = async () => {
    if (!bulkReviewerId) { toast("Vui lòng chọn GVPB", "error"); return; }
    setBulkSaving(true);
    const result = await bulkAssignReviewerAction(Array.from(selected), bulkReviewerId);
    setBulkSaving(false);
    if (result.success) {
      toast(result.message ?? "Đã lưu", "success");
      setSelected(new Set()); setBulkReviewerId(""); router.refresh();
    } else { toast(result.error, "error"); }
  };

  async function handleChangeReviewer(topicId: string, newReviewerId: string) {
    if (!newReviewerId) return;
    setEditValue(newReviewerId);
    setSaving(true);
    const result = await reassignReviewerAction(topicId, newReviewerId);
    setSaving(false);
    if (result.success) {
      toast("Đã cập nhật GVPB!", "success");
      setEditingId(null); setEditValue(""); router.refresh();
    } else { toast(result.error, "error"); setEditValue(""); }
  }

  const hasFilter = search || statusFilter || gvpbFilter;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên SV, MSSV hoặc tên đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={gvpbFilter}
          onChange={(e) => setGvpbFilter(e.target.value)}
          className="shrink-0 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
        >
          <option value="">Tất cả GVPB</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>{r.full_name}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setGvpbFilter(""); }}
            className="shrink-0 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1 bg-white"
          >
            <X className="w-3.5 h-3.5" /> Xoá bộ lọc
          </button>
        )}

        <p className="shrink-0 text-xs text-slate-400">
          <span className="font-semibold text-slate-600">{filtered.length}</span> / {topics.length} đề tài
        </p>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-800">Đã chọn {selected.size} đề tài</span>
          <div className="min-w-56">
            <LecturerCombobox
              options={lecturers}
              value={bulkReviewerId}
              onChange={setBulkReviewerId}
              placeholder="Tìm GVPB..."
            />
          </div>
          <button
            onClick={handleBulkSave}
            disabled={bulkSaving || !bulkReviewerId}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {bulkSaving ? "Đang lưu..." : `Lưu cho ${selected.size} đề tài`}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline">
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-clip">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Sinh viên</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Tên đề tài</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Đợt</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">GVHD</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">GVPB</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="appearance-none bg-transparent w-full pr-5 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer focus:outline-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">Không có kết quả phù hợp</td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className={`border-b border-slate-50 hover:bg-slate-50 ${selected.has(t.id) ? "bg-blue-50 hover:bg-blue-50" : ""}`}>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <p className="font-medium text-slate-800">{t.student?.full_name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{t.student?.student_code ?? ""}</p>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <p className={t.gvhdFailed ? "text-red-600 font-medium" : "text-slate-700"}>{t.title}</p>
                        {t.gvhdFailed && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                            GVHD &lt; 5
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="text-xs text-slate-500">{t.batch}</span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <p className="text-slate-600">{t.supervisor?.full_name ?? "—"}</p>
                    </td>
                    <td className="py-2 px-3">
                      {editingId === t.id ? (
                        <div className={`min-w-48 ${saving ? "opacity-60 pointer-events-none" : ""}`}>
                          <LecturerCombobox
                            options={lecturers.filter((l) => l.value !== t.supervisor_id)}
                            value={editValue}
                            onChange={(id) => handleChangeReviewer(t.id, id)}
                            placeholder="Tìm giảng viên..."
                          />
                          <button
                            onClick={() => { setEditingId(null); setEditValue(""); }}
                            className="mt-1 text-xs text-slate-400 hover:text-slate-600"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{t.reviewer?.full_name ?? "—"}</p>
                          <button
                            onClick={() => { setEditingId(t.id); setEditValue(""); }}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Đổi GVPB"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <TopicStatusBadge status={t.current_status} type={t.topic_type as "KLTN" | "BCTT"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
