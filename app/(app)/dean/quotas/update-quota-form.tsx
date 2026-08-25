"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { updateQuotaAction } from "@/app/actions/user.actions";

export function UpdateQuotaForm({
  lecturerId, currentQuota, academicYear, semester, batch,
}: {
  lecturerId: string; currentQuota: number;
  academicYear: string; semester: string; batch: string;
}) {
  const router = useRouter();
  const [quota, setQuota] = useState(currentQuota.toString());
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    const q = parseInt(quota);
    if (isNaN(q) || q < 0) { toast("Hạn mức phải là số không âm", "error"); return; }
    setLoading(true);
    const result = await updateQuotaAction(lecturerId, q, academicYear, semester, batch);
    setLoading(false);
    if (result.success) {
      toast("Đã cập nhật hạn mức", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max="50"
        value={quota}
        onChange={(e) => setQuota(e.target.value)}
        className="w-16 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-xs text-slate-400">SV</span>
      <button
        onClick={handleUpdate}
        disabled={loading}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "..." : "Lưu"}
      </button>
    </div>
  );
}
