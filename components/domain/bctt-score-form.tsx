"use client";

import { useState } from "react";
import { Button } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { submitScoreAction } from "@/app/actions/topic.actions";
import { cn } from "@/lib/utils";

interface BcttScoreFormProps {
  topicId: string;
  existingScore?: number;
  existingComment?: string;
}

export function BcttScoreForm({ topicId, existingScore, existingComment }: BcttScoreFormProps) {
  const [score, setScore] = useState<string>(existingScore?.toString() ?? "");
  const [comment, setComment] = useState(existingComment ?? "");
  const [loading, setLoading] = useState(false);

  const val = parseFloat(score);
  const isValid = !isNaN(val) && val >= 1 && val <= 10;
  const isPassing = isValid && val >= 5;

  async function handleSubmit() {
    if (!isValid) {
      toast("Vui lòng nhập điểm từ 1 đến 10", "error");
      return;
    }

    setLoading(true);
    const result = await submitScoreAction(topicId, val, comment, "SUPERVISOR");
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Đã lưu điểm", "success");
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Ô nhập điểm */}
      <div className="flex flex-col items-center gap-3 py-4">
        <label className="text-sm font-medium text-slate-600">Điểm báo cáo thực tập (1 – 10)</label>
        <input
          type="number"
          step="0.5"
          min="1"
          max="10"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="—"
          className={cn(
            "w-28 text-center text-4xl font-black border-2 rounded-2xl px-3 py-3 focus:outline-none transition-all",
            score === ""
              ? "border-slate-200 text-slate-300"
              : isValid
                ? isPassing
                  ? "border-green-400 text-green-700 bg-green-50"
                  : "border-red-400 text-red-700 bg-red-50"
                : "border-red-400 text-red-600 bg-red-50",
          )}
        />
        {isValid && (
          <span className={cn(
            "text-sm font-semibold px-3 py-1 rounded-full",
            isPassing ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
          )}>
            {isPassing ? "Đạt" : "Chưa đạt"}
          </span>
        )}
        {score !== "" && !isValid && (
          <p className="text-xs text-red-600">Điểm phải từ 1 đến 10</p>
        )}
      </div>

      {/* Nhận xét */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nhận xét</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Nhận xét về báo cáo thực tập..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!isValid}
        className="w-full"
        size="lg"
      >
        {existingScore !== undefined ? "Cập nhật điểm" : "Xác nhận điểm"}
      </Button>
    </div>
  );
}
