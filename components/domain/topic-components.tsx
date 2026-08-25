import { cn } from "@/lib/utils";
import { KLTN_STATUS_LABELS, BCTT_STATUS_LABELS, KLTN_STATUS_COLORS } from "@/lib/constants";
import type { KltnStatus, BcttStatus, TopicStatusHistory } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Circle } from "lucide-react";

// ─── STATUS BADGE ────────────────────────────────────────────

export function TopicStatusBadge({ status, type }: {
  status: string;
  type: "KLTN" | "BCTT";
}) {
  const label = type === "KLTN"
    ? KLTN_STATUS_LABELS[status as KltnStatus] ?? status
    : BCTT_STATUS_LABELS[status as BcttStatus] ?? status;

  const color = KLTN_STATUS_COLORS[status as KltnStatus] ?? "bg-slate-100 text-slate-600";

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", color)}>
      {label}
    </span>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────

interface TimelineItem extends TopicStatusHistory {
  changer_name?: string;
}

export function StatusTimeline({ items }: { items: TimelineItem[] }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">Chưa có lịch sử trạng thái</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFail = item.new_status.includes("KHONG_DAT") || item.new_status.includes("TU_CHOI");
        const isDone = item.new_status === "HOAN_TAT";

        return (
          <div key={item.id} className="flex gap-4">
            {/* Dot + line */}
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                isDone ? "bg-green-100" : isFail ? "bg-red-100" : "bg-blue-100"
              )}>
                {isDone
                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : isFail
                  ? <XCircle className="w-4 h-4 text-red-600" />
                  : isLast
                  ? <Clock className="w-4 h-4 text-blue-600" />
                  : <Circle className="w-3 h-3 text-blue-400 fill-blue-400" />}
              </div>
              {!isLast && <div className="w-0.5 h-full bg-slate-200 mt-1 mb-1" />}
            </div>

            {/* Content */}
            <div className={cn("pb-5 flex-1", isLast && "pb-0")}>
              <div className="flex items-center justify-between">
                <TopicStatusBadge status={item.new_status} type="KLTN" />
                <span className="text-xs text-slate-400">{formatDateTime(item.changed_at)}</span>
              </div>
              {item.note && (
                <p className="text-xs text-slate-500 mt-1">{item.note}</p>
              )}
              {item.changer_name && (
                <p className="text-xs text-slate-400 mt-0.5">bởi {item.changer_name}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SCORE DISPLAY ───────────────────────────────────────────

export function ScoreDisplay({ label, score, comment, showScore = true }: {
  label: string;
  score: number | null;
  comment?: string | null;
  showScore?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      {score === null ? (
        <p className="text-sm text-slate-400 italic">Chưa chấm điểm</p>
      ) : (
        <>
          {showScore && (
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "text-2xl font-bold",
                score > 5 ? "text-green-600" : "text-red-600"
              )}>{score.toFixed(1)}</span>
              <span className="text-sm text-slate-400">/ 10</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium ml-1",
                score > 5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {score > 5 ? "Đạt" : "Không đạt"}
              </span>
            </div>
          )}
          {comment && <p className="text-sm text-slate-600 italic">"{comment}"</p>}
        </>
      )}
    </div>
  );
}
