"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { bulkAssignReviewerAction } from "@/app/actions/topic.actions";
import { AssignReviewerForm, LecturerCombobox } from "./assign-reviewer-form";
import { TopicStatusBadge } from "@/components/domain/topic-components";

interface Topic {
  id: string;
  title: string;
  current_status: string;
  supervisor_id: string;
  academic_year: string;
  semester: string;
  batch: string;
  student: { full_name: string; student_code?: string; department?: string } | null;
  supervisor: { full_name: string } | null;
  gvhdFailed?: boolean;
}

interface Props {
  topics: Topic[];
  lecturers: { value: string; label: string }[];
}

export function AssignBulkSection({ topics, lecturers }: Props) {
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [saving, setSaving] = useState(false);

  const allChecked = selected.size === topics.length && topics.length > 0;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(topics.map((t) => t.id)));
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkSave = async () => {
    if (!bulkReviewerId) { toast("Vui lòng chọn GVPB", "error"); return; }
    if (selected.size === 0) { toast("Chưa chọn đề tài nào", "error"); return; }
    setSaving(true);
    const result = await bulkAssignReviewerAction(Array.from(selected), bulkReviewerId);
    setSaving(false);
    if (result.success) {
      toast(result.message ?? "Đã lưu", "success");
      setSelected(new Set());
      setBulkReviewerId("");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-800">Đã chọn {selected.size} đề tài</span>
          <div className="min-w-55">
            <LecturerCombobox
              options={lecturers}
              value={bulkReviewerId}
              onChange={setBulkReviewerId}
              placeholder="Tìm GVPB..."
            />
          </div>
          <button
            onClick={handleBulkSave}
            disabled={saving || !bulkReviewerId}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? "Đang lưu..." : `Lưu cho ${selected.size} đề tài`}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline">
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* Bảng */}
      <div className="overflow-x-clip">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="py-2 px-3 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
              </th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Sinh viên</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Tên đề tài</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Đợt</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">GVHD</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">GVPB</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
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
                  <p className="text-xs text-slate-400">{t.student?.student_code}</p>
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${t.gvhdFailed ? "text-red-600 font-medium" : "text-slate-700"}`}>{t.title}</p>
                    {t.gvhdFailed && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                        GVHD &lt; 5
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <p className="text-xs text-slate-500">{t.academic_year}</p>
                  <p className="text-xs text-slate-400">HK{t.semester} · Đ{t.batch}</p>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <p className="text-sm text-slate-700">{t.supervisor?.full_name ?? "—"}</p>
                </td>
                <td className="py-2 px-3">
                  <AssignReviewerForm
                    topicId={t.id}
                    supervisorId={t.supervisor_id}
                    lecturers={lecturers}
                  />
                </td>
                <td className="py-2 px-3">
                  <TopicStatusBadge status={t.current_status} type="KLTN" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
