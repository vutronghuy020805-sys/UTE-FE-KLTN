"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { toast } from "@/components/ui/index";
import { updateActiveTermDeadlinesAction } from "@/app/actions/reminder.actions";

interface Props {
  currentKltnDeadline: string | null;
  currentBcttDeadline: string | null;
}

export function DeadlineSettingsForm({ currentKltnDeadline, currentBcttDeadline }: Props) {
  const router = useRouter();
  const [kltn, setKltn] = useState(currentKltnDeadline ?? "");
  const [bctt, setBctt] = useState(currentBcttDeadline ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!kltn && !bctt) {
      toast("Vui lòng nhập ít nhất một hạn nộp", "error");
      return;
    }
    setSaving(true);
    const res = await updateActiveTermDeadlinesAction(kltn, bctt);
    setSaving(false);
    if (res.success) {
      toast("Đã lưu hạn nộp thành công", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            Hạn nộp KLTN
          </label>
          <input
            type="date"
            value={kltn}
            onChange={(e) => setKltn(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentKltnDeadline && (
            <p className="text-xs text-slate-400">Hiện tại: {currentKltnDeadline}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            Hạn nộp BCTT
          </label>
          <input
            type="date"
            value={bctt}
            onChange={(e) => setBctt(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {currentBcttDeadline && (
            <p className="text-xs text-slate-400">Hiện tại: {currentBcttDeadline}</p>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Đang lưu..." : "Lưu hạn nộp"}
      </button>
    </div>
  );
}
