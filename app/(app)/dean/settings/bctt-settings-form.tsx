"use client";

import { useState } from "react";
import { toast } from "@/components/ui/index";
import { runBcttAutoAction } from "@/app/actions/settings.actions";
import { Zap } from "lucide-react";

export function BcttSettingsForm() {
  const [approve, setApprove] = useState(false);
  const [pass, setPass] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleRun() {
    if (!approve && !pass) {
      toast("Chưa chọn hành động nào", "error");
      return;
    }
    setSaving(true);
    const result = await runBcttAutoAction(approve, pass);
    setSaving(false);
    if (result.success) {
      toast(result.message ?? "Hoàn tất", "success");
      setApprove(false);
      setPass(false);
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <input
            id="approve-toggle"
            type="checkbox"
            checked={approve}
            onChange={(e) => setApprove(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
          />
          <label htmlFor="approve-toggle" className="text-sm font-semibold text-slate-800 cursor-pointer">
            Duyệt tất cả BCTT đang chờ xác nhận
          </label>
        </div>
        <p className="text-xs text-slate-500 ml-7">
          Chuyển tất cả đề tài BCTT từ <span className="font-medium text-amber-600">Chờ GVHD xác nhận</span> sang{" "}
          <span className="font-medium text-blue-600">Đang thực hiện</span> ngay lập tức.
        </p>
      </div>

      <div className="border border-slate-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <input
            id="pass-toggle"
            type="checkbox"
            checked={pass}
            onChange={(e) => setPass(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
          />
          <label htmlFor="pass-toggle" className="text-sm font-semibold text-slate-800 cursor-pointer">
            Pass tất cả BCTT đã nộp báo cáo
          </label>
        </div>
        <p className="text-xs text-slate-500 ml-7">
          Chuyển tất cả đề tài BCTT từ <span className="font-medium text-blue-600">Đã nộp báo cáo</span> sang{" "}
          <span className="font-medium text-green-600">Hoàn tất</span> ngay lập tức.
        </p>
      </div>

      <button
        onClick={handleRun}
        disabled={saving || (!approve && !pass)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Zap className="w-4 h-4" />
        {saving ? "Đang thực hiện..." : "Thực hiện ngay"}
      </button>
    </div>
  );
}
