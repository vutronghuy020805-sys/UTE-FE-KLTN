"use client";

import { useState } from "react";
import { Bell, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { triggerDeadlineReminderAction } from "@/app/actions/cron.actions";

export function TriggerReminderButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    emailsSent?: number;
    notifsSent?: number;
    log?: string[];
    error?: string;
  } | null>(null);
  const [showLog, setShowLog] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    setResult(null);
    const res = await triggerDeadlineReminderAction();
    setResult(res.data ?? { ok: false, error: res.error ?? "Lỗi không xác định" });
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleTrigger}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        Gửi nhắc hạn ngay
      </button>

      {result && (
        <div
          className={`w-full text-sm rounded-lg border px-4 py-3 ${
            result.ok
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {result.ok ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            {result.ok
              ? `Hoàn tất — ${result.emailsSent ?? 0} email, ${result.notifsSent ?? 0} in-app notification`
              : `Lỗi: ${result.error}`}
          </div>
          {result.log && result.log.length > 0 && (
            <button
              onClick={() => setShowLog((v) => !v)}
              className="mt-1.5 text-xs underline opacity-70 hover:opacity-100"
            >
              {showLog ? "Ẩn log" : "Xem log chi tiết"}
            </button>
          )}
          {showLog && result.log && (
            <pre className="mt-2 text-xs whitespace-pre-wrap opacity-80 max-h-48 overflow-y-auto bg-white/60 rounded p-2">
              {result.log.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
