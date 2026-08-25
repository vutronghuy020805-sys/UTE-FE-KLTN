"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Textarea } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { submitScoreAction } from "@/app/actions/topic.actions";
import { cn } from "@/lib/utils";

interface ScoreFormProps {
  topicId: string;
  role: "SUPERVISOR" | "REVIEWER" | "COMMITTEE_MEMBER";
  existingScore?: number;
  existingComment?: string;
  onSuccess?: () => void;
}

export function ScoreForm({ topicId, role, existingScore, existingComment, onSuccess }: ScoreFormProps) {
  const [score, setScore] = useState<string>(existingScore?.toString() ?? "");
  const [comment, setComment] = useState(existingComment ?? "");
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const scoreNum = parseFloat(score);
  const isValid = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 10;
  const isPassing = isValid && scoreNum > 5;

  // Quick score buttons
  const quickScores = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0];

  async function handleSubmit() {
    if (!isValid) {
      toast("Điểm phải trong khoảng 0 - 10", "error");
      return;
    }
    // Xác nhận khi GVHD/GVPB chấm KHÔNG ĐẠT — vì sẽ gửi email cho SV ngay
    if ((role === "SUPERVISOR" || role === "REVIEWER") && scoreNum < 5) {
      const ok = window.confirm(
        "Sinh viên sẽ được email ngay lập tức về kết quả không đạt của KLTN. Bạn có đồng ý với kết quả này?",
      );
      if (!ok) return;
    }
    setLoading(true);
    const result = await submitScoreAction(topicId, scoreNum, comment, role);
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã lưu điểm", "success");
      onSuccess?.();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Score input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">Điểm số (0 - 10)</label>

        {/* Quick select */}
        <div className="flex flex-wrap gap-2 mb-3">
          {quickScores.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setScore(q.toString())}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                score === q.toString()
                  ? "bg-blue-600 text-white border-blue-600"
                  : q > 5
                  ? "border-green-200 text-green-700 hover:bg-green-50"
                  : "border-red-200 text-red-700 hover:bg-red-50"
              )}
            >
              {q.toFixed(1)}
            </button>
          ))}
        </div>

        {/* Manual input */}
        <div className="relative">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Nhập điểm..."
            className={cn(
              "w-full px-4 py-3 text-2xl font-bold border-2 rounded-xl text-center transition-all focus:outline-none",
              !score ? "border-slate-200 text-slate-400"
                : isPassing ? "border-green-400 text-green-600 bg-green-50"
                : "border-red-400 text-red-600 bg-red-50"
            )}
          />
          {score && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className={cn(
                "text-sm font-bold px-3 py-1 rounded-full",
                isPassing ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {isPassing ? "✓ Đạt" : "✗ Không đạt"}
              </span>
            </div>
          )}
        </div>

        {score && (
          <p className="text-xs text-slate-400 mt-2 text-center">
            Ngưỡng đạt: &gt; 5.0 điểm
          </p>
        )}
      </div>

      {/* Star visual */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Star
            key={i}
            className={cn(
              "w-5 h-5 cursor-pointer transition-colors",
              (hovered !== null ? i <= hovered : i <= scoreNum)
                ? "text-amber-400 fill-amber-400"
                : "text-slate-200 fill-slate-200"
            )}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setScore(i.toString())}
          />
        ))}
        <span className="text-xs text-slate-400 ml-2">/ 10</span>
      </div>

      {/* Comment */}
      <Textarea
        label="Nhận xét"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="Nhập nhận xét của bạn về bài khóa luận..."
      />

      {/* Warning if failing score */}
      {score && !isPassing && isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠️ Điểm này sẽ đánh dấu hồ sơ là <strong>không đạt</strong>.
          {role === "SUPERVISOR" && " Sinh viên sẽ nhận thông báo và hồ sơ sẽ không chuyển sang bước tiếp theo."}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!isValid}
        className="w-full"
        size="lg"
      >
        {existingScore !== undefined ? "Cập nhật điểm" : "Lưu điểm chấm"}
      </Button>
    </div>
  );
}
