"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Check, Loader2 } from "lucide-react";
import { savePresentationTimeAction } from "@/app/actions/topic.actions";
import { computeTimeScore } from "@/lib/constants";

interface Props {
  topicId: string;
  initialMinutes: number | null;
  canEdit: boolean;
  /** Hiển thị gọn — không label, không help text. Dùng khi nhúng vào stat card. */
  compact?: boolean;
}

type Status = "idle" | "saving" | "saved" | "error";

export function PresentationTimeInput({ topicId, initialMinutes, canEdit, compact = false }: Props) {
  const [value, setValue] = useState(initialMinutes !== null ? String(initialMinutes) : "");
  const [status, setStatus] = useState<Status>("idle");
  const lastSavedRef = useRef(initialMinutes !== null ? String(initialMinutes) : "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    if (value === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      const minutes = value.trim() === "" ? null : parseFloat(value);
      if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0)) {
        setStatus("error");
        return;
      }
      const result = await savePresentationTimeAction(topicId, minutes);
      if (result.success) {
        lastSavedRef.current = value;
        setStatus("saved");
      } else {
        setStatus("error");
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, topicId, canEdit]);

  const minutes = value.trim() === "" ? null : parseFloat(value);
  const autoScore = computeTimeScore(minutes);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.5"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!canEdit}
            placeholder="VD: 9.5"
            className="w-20 px-2 py-1.5 text-sm text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            title="Thời gian thuyết trình (phút)"
          />
          <span className="text-xs text-slate-400">phút</span>
          <Indicator status={status} />
        </div>
        {autoScore !== null && (
          <div className="text-xs text-slate-600">
            Điểm tự:{" "}
            <span className={`font-bold ${autoScore >= 0.3 ? "text-green-600" : "text-red-600"}`}>
              {autoScore.toFixed(1)}/0.5
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        <Clock className="inline w-4 h-4 mr-1 text-slate-500" />
        Thời gian thuyết trình
        <span className="ml-1 text-xs font-normal text-slate-400">(phút)</span>
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          step="0.5"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!canEdit}
          placeholder="VD: 9.5"
          className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
        />
        {autoScore !== null && (
          <div className="text-xs text-slate-600">
            Điểm tự động:{" "}
            <span className={`font-bold ${autoScore >= 0.3 ? "text-green-600" : "text-red-600"}`}>
              {autoScore.toFixed(1)}/0.5
            </span>
          </div>
        )}
        <Indicator status={status} />
      </div>
      <p className="text-xs text-slate-500">
        Hệ thống tự chấm tiêu chí "Thời gian": ≤10p → 0.5 · ≤12p → 0.3 · ≤14p → 0.1 · &gt;14p → 0
      </p>
    </div>
  );
}

function Indicator({ status }: { status: Status }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-xs text-green-600 flex items-center gap-1">
        <Check className="w-3 h-3" /> Đã lưu
      </span>
    );
  }
  return <span className="text-xs text-red-600">Lưu thất bại</span>;
}
