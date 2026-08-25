"use client";

import { useState } from "react";
import { Wrench, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { fixCommitteeStatusMismatchAction } from "@/app/actions/topic.actions";

export function FixCommitteeStatusButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    fixed?: number;
    details?: string[];
    error?: string;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function handleClick() {
    if (!confirm("Quét & sửa các đề tài đã trong HĐ nhưng status còn ở pha phản biện. Tiếp tục?")) return;
    setLoading(true);
    setResult(null);
    const res = await fixCommitteeStatusMismatchAction();
    if (res.success) {
      setResult({ ok: true, fixed: res.data?.fixed ?? 0, details: res.data?.details ?? [] });
    } else {
      setResult({ ok: false, error: res.error });
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 w-fit"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
        Sửa status lệch (đã vào HĐ nhưng status pha phản biện)
      </button>

      {result && (
        <div
          className={`text-sm rounded-lg border px-4 py-3 ${
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
              ? `Hoàn tất — đã sửa ${result.fixed} đề tài`
              : `Lỗi: ${result.error}`}
          </div>
          {result.ok && result.details && result.details.length > 0 && (
            <>
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="mt-1.5 text-xs underline opacity-70 hover:opacity-100"
              >
                {showDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
              </button>
              {showDetails && (
                <pre className="mt-2 text-xs whitespace-pre-wrap opacity-80 max-h-48 overflow-y-auto bg-white/60 rounded p-2">
                  {result.details.join("\n")}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
