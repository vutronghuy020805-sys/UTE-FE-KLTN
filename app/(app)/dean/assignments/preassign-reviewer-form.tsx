"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { preassignReviewerAction } from "@/app/actions/topic.actions";

interface Props {
  studentId: string;
  academicYear: string;
  semester: string;
  lecturers: { value: string; label: string }[];
  currentReviewerEmail: string;
}

export function PreassignReviewerForm({ studentId, academicYear, semester, lecturers, currentReviewerEmail }: Props) {
  const router = useRouter();
  const [reviewerEmail, setReviewerEmail] = useState(currentReviewerEmail);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!reviewerEmail) { toast("Vui lòng chọn giảng viên phản biện", "error"); return; }
    setSaving(true);
    const result = await preassignReviewerAction(studentId, reviewerEmail, academicYear, semester);
    setSaving(false);
    if (result.success) {
      toast(result.message ?? "Đã lưu", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={reviewerEmail}
        onChange={(e) => setReviewerEmail(e.target.value)}
        className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
      >
        <option value="">-- Chọn GVPB --</option>
        {lecturers.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving || !reviewerEmail}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {saving ? "..." : "Lưu"}
      </button>
    </div>
  );
}
