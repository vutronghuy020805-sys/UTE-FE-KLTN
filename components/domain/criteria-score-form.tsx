"use client";

import { useState } from "react";
import { Button } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { submitScoreAction } from "@/app/actions/topic.actions";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { isTimeCriterionLabel } from "@/lib/constants";

export interface RubricLevel { range: string; desc: string }
export interface CriterionDef {
  key: string;
  label: string;
  maxScore?: number;
  rubric?: { yeu: RubricLevel; trung_binh: RubricLevel; kha: RubricLevel; gioi: RubricLevel };
}

interface CriteriaScoreFormProps {
  topicId: string;
  role: "SUPERVISOR" | "REVIEWER" | "COMMITTEE_MEMBER";
  existingScore?: number;
  existingComment?: string;
  onSuccess?: () => void;
  customCriteria?: CriterionDef[];
  /** Điểm tự động cho tiêu chí "Thời gian" (khi thư ký đã nhập thời gian thuyết trình).
   *  Áp dụng cho COMMITTEE_MEMBER khi member chưa lưu điểm. Member vẫn override được. */
  autoTimeScore?: number | null;
}

const CRITERIA_BY_ROLE = {
  SUPERVISOR: [
    { key: "tc1", label: "Tiêu chí 1", desc: "Nội dung & tính khoa học" },
    { key: "tc2", label: "Tiêu chí 2", desc: "Phương pháp nghiên cứu" },
    { key: "tc3", label: "Tiêu chí 3", desc: "Kết quả & đóng góp" },
    { key: "tc4", label: "Tiêu chí 4", desc: "Hình thức & trình bày" },
    { key: "tc5", label: "Tiêu chí 5", desc: "Tiến độ thực hiện" },
    { key: "tc6", label: "Tiêu chí 6", desc: "Khả năng làm việc độc lập" },
    { key: "tc7", label: "Tiêu chí 7", desc: "Tính ứng dụng thực tiễn" },
  ],
  REVIEWER: [
    { key: "tc1", label: "Tiêu chí 1", desc: "Mục đích & tính mới của đề tài" },
    { key: "tc2", label: "Tiêu chí 2", desc: "Phương pháp nghiên cứu" },
    { key: "tc3", label: "Tiêu chí 3", desc: "Độ chính xác & tính logic" },
    { key: "tc4", label: "Tiêu chí 4", desc: "Kết quả & đóng góp" },
    { key: "tc5", label: "Tiêu chí 5", desc: "Hình thức & trình bày" },
    { key: "tc6", label: "Tiêu chí 6", desc: "Tài liệu tham khảo" },
    { key: "tc7", label: "Tiêu chí 7", desc: "Trả lời câu hỏi phản biện" },
  ],
  COMMITTEE_MEMBER: [
    { key: "tc1", label: "Tiêu chí 1", desc: "Nội dung & tính khoa học của khóa luận" },
    { key: "tc2", label: "Tiêu chí 2", desc: "Phương pháp nghiên cứu" },
    { key: "tc3", label: "Tiêu chí 3", desc: "Kết quả & đóng góp thực tiễn" },
    { key: "tc4", label: "Tiêu chí 4", desc: "Hình thức & trình bày tài liệu" },
    { key: "tc5", label: "Tiêu chí 5", desc: "Kỹ năng trình bày & bảo vệ" },
    { key: "tc6", label: "Tiêu chí 6", desc: "Trả lời câu hỏi phản biện" },
    { key: "tc7", label: "Tiêu chí 7", desc: "Tính sáng tạo & ứng dụng" },
  ],
};

const PASSING_SCORE = 5;

function parseCriteria(comment: string): Record<string, number> {
  try {
    const parsed = JSON.parse(comment);
    if (parsed.__criteria) return parsed.__criteria;
  } catch { /* not JSON */ }
  return {};
}

function parseCauHoi(comment: string): string {
  try {
    const parsed = JSON.parse(comment);
    return parsed.__cau_hoi ?? "";
  } catch { return ""; }
}

// ── Shared table cell style ───────────────────────────────────────────────────
const TD = "border border-slate-300 px-2 py-2 text-xs align-top";
const TH = "border border-slate-300 px-2 py-2 text-xs font-bold text-center bg-slate-100";

export function CriteriaScoreForm({
  topicId, role, existingScore, existingComment, onSuccess, customCriteria, autoTimeScore,
}: CriteriaScoreFormProps) {
  const baseCriteria: CriterionDef[] = customCriteria && customCriteria.length > 0
    ? customCriteria
    : CRITERIA_BY_ROLE[role].map((c) => ({ key: c.key, label: `${c.label}: ${c.desc}` }));
  const criteria = baseCriteria.map((c) => ({ ...c, maxScore: c.maxScore ?? 10 }));
  const maxTotal = Math.min(10, criteria.reduce((s, c) => s + c.maxScore, 0));
  const existingCriteria = existingComment ? parseCriteria(existingComment) : {};

  // Tìm key của tiêu chí "Thời gian" (chỉ dùng cho HĐ + có autoTimeScore)
  const timeCriterionKey =
    role === "COMMITTEE_MEMBER" && autoTimeScore !== null && autoTimeScore !== undefined
      ? criteria.find((c) => isTimeCriterionLabel(c.label))?.key
      : undefined;

  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(
      criteria.map((c) => {
        const existing = existingCriteria[c.key];
        if (existing !== undefined) return [c.key, existing.toString()];
        // Auto-fill tiêu chí "Thời gian" nếu thư ký đã nhập + member chưa lưu
        if (c.key === timeCriterionKey && autoTimeScore !== null && autoTimeScore !== undefined) {
          return [c.key, autoTimeScore.toString()];
        }
        return [c.key, ""];
      }),
    ),
  );
  const [generalComment, setGeneralComment] = useState(
    existingComment
      ? (() => { try { const p = JSON.parse(existingComment); return p.__text ?? ""; } catch { return existingComment; } })()
      : "",
  );
  const [cauHoi, setCauHoi] = useState(existingComment ? parseCauHoi(existingComment) : "");
  const [loading, setLoading] = useState(false);

  // Giá trị thô user nhập
  const parsedScores = criteria.map((c) => ({
    key: c.key,
    raw: scores[c.key] === "" ? null : parseFloat(scores[c.key]),
  }));

  // Cap giá trị tại maxScore của từng tiêu chí (nhập lố → lấy max)
  const cappedScores = parsedScores.map(({ key, raw }, i) => {
    const max = criteria[i]?.maxScore ?? 10;
    if (raw === null || isNaN(raw)) return { key, value: null as number | null, capped: false };
    const clamped = Math.max(0, Math.min(raw, max));
    return { key, value: clamped, capped: raw > max };
  });

  // Báo lỗi chỉ khi giá trị âm hoặc NaN — nhập lố thì auto cap, không báo lỗi
  const hasInvalid = parsedScores.some(({ raw }) => {
    return raw !== null && (isNaN(raw) || raw < 0);
  });

  const filledCount = cappedScores.filter(({ value }) => value !== null).length;
  const sumFilled = cappedScores.reduce((s, { value }) => s + (value ?? 0), 0);
  const totalCapped = Math.min(maxTotal, Math.round(sumFilled * 100) / 100);
  const hasCappedAny = cappedScores.some((s) => s.capped);
  const hasFilled = filledCount > 0;
  const isPassed = hasFilled && sumFilled >= PASSING_SCORE;
  const showResult = hasFilled && !hasInvalid;
  const hasError = hasInvalid;

  async function handleSubmit() {
    if (!hasFilled) { toast("Vui lòng nhập ít nhất một tiêu chí", "error"); return; }
    if (hasInvalid) { toast("Điểm không được âm", "error"); return; }

    // Xác nhận khi GVHD/GVPB chấm KHÔNG ĐẠT — vì sẽ gửi email cho SV ngay
    if ((role === "SUPERVISOR" || role === "REVIEWER") && totalCapped < PASSING_SCORE) {
      const ok = window.confirm(
        "Sinh viên sẽ được email ngay lập tức về kết quả không đạt của KLTN. Bạn có đồng ý với kết quả này?",
      );
      if (!ok) return;
    }

    // Lưu giá trị đã cap (không lưu giá trị thô vượt max)
    const criteriaValues: Record<string, number> = {};
    cappedScores.forEach(({ key, value }) => { if (value !== null) criteriaValues[key] = value; });
    const commentData = JSON.stringify({ __criteria: criteriaValues, __text: generalComment, __cau_hoi: cauHoi });

    setLoading(true);
    const result = await submitScoreAction(topicId, totalCapped, commentData, role);
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Đã lưu điểm", "success");
      onSuccess?.();
    } else {
      toast(result.error, "error");
    }
  }

  // Kiểm tra xem có bất kỳ tiêu chí nào có rubric không
  const hasAnyRubric = criteria.some((c) => c.rubric);

  return (
    <div className="space-y-5">
      {/* ── Bảng tiêu chí ── */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-300">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(TH, "text-left w-40")}>Tiêu chí đánh giá</th>
              {hasAnyRubric ? (
                <>
                  <th className={cn(TH, "text-red-700")}>Yếu</th>
                  <th className={cn(TH, "text-amber-700")}>Trung Bình</th>
                  <th className={cn(TH, "text-blue-700")}>Khá</th>
                  <th className={cn(TH, "text-green-700")}>Giỏi</th>
                </>
              ) : (
                <th className={TH}>Mô tả</th>
              )}
              <th className={cn(TH, "w-24")}>Điểm</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const maxScore = c.maxScore ?? 10;
              const val = parseFloat(scores[c.key] ?? "");
              const filled = scores[c.key] !== "" && !isNaN(val) && val >= 0;
              // Nhập âm = lỗi; nhập lố = cap (cam), không phải lỗi
              const negative = scores[c.key] !== "" && (!filled || val < 0);
              const overMax = scores[c.key] !== "" && !isNaN(val) && val > maxScore;

              const isAutoFilled = c.key === timeCriterionKey;
              const scoreInput = (
                <div className="flex flex-col items-center gap-0.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={scores[c.key]}
                    onChange={(e) => setScores({ ...scores, [c.key]: e.target.value })}
                    placeholder={`0–${maxScore}`}
                    className={cn(
                      "w-16 px-1 py-1.5 text-center font-bold text-base border-2 rounded-lg focus:outline-none transition-all",
                      negative
                        ? "border-red-400 text-red-700 bg-red-50"
                        : overMax
                        ? "border-amber-400 text-amber-700 bg-amber-50"
                        : filled
                        ? "border-blue-400 text-blue-700 bg-blue-50"
                        : "border-slate-200 text-slate-500",
                    )}
                    title={overMax ? `Nhập lố — tính tối đa ${maxScore}` : undefined}
                  />
                  <span className={cn("text-xs", overMax ? "text-amber-600 font-medium" : "text-slate-400")}>
                    {overMax ? `→ ${maxScore}` : `/${maxScore}`}
                  </span>
                  {isAutoFilled && (
                    <span className="text-[10px] text-blue-600 font-medium" title="Điểm do thư ký nhập thời gian thuyết trình → hệ thống tự chấm. Vẫn có thể sửa.">
                      auto
                    </span>
                  )}
                </div>
              );

              if (c.rubric) {
                // Tiêu chí có rubric → 2 hàng: hàng khoảng điểm + hàng mô tả
                return (
                  <>
                    <tr key={c.key + "-range"}>
                      <td className={cn(TD, "font-semibold text-slate-800 align-middle")} rowSpan={2}>
                        {c.label}
                      </td>
                      <td className={cn(TD, "text-center font-bold text-red-700 bg-red-50")}>{c.rubric.yeu.range}</td>
                      <td className={cn(TD, "text-center font-bold text-amber-700 bg-amber-50")}>{c.rubric.trung_binh.range}</td>
                      <td className={cn(TD, "text-center font-bold text-blue-700 bg-blue-50")}>{c.rubric.kha.range}</td>
                      <td className={cn(TD, "text-center font-bold text-green-700 bg-green-50")}>{c.rubric.gioi.range}</td>
                      <td className={cn(TD, "text-center align-middle")} rowSpan={2}>{scoreInput}</td>
                    </tr>
                    <tr key={c.key + "-desc"}>
                      <td className={cn(TD, "text-slate-600 bg-red-50/40 leading-relaxed")}>{c.rubric.yeu.desc}</td>
                      <td className={cn(TD, "text-slate-600 bg-amber-50/40 leading-relaxed")}>{c.rubric.trung_binh.desc}</td>
                      <td className={cn(TD, "text-slate-600 bg-blue-50/40 leading-relaxed")}>{c.rubric.kha.desc}</td>
                      <td className={cn(TD, "text-slate-600 bg-green-50/40 leading-relaxed")}>{c.rubric.gioi.desc}</td>
                    </tr>
                  </>
                );
              }

              // Tiêu chí không có rubric → 1 hàng, tên trải dài qua tất cả cột level
              return (
                <tr key={c.key}>
                  <td className={cn(TD, "text-slate-700 leading-relaxed")} colSpan={hasAnyRubric ? 5 : 2}>
                    {c.label}
                  </td>
                  <td className={cn(TD, "text-center")}>{scoreInput}</td>
                </tr>
              );
            })}

            {/* Hàng tổng điểm */}
            <tr className="bg-slate-50">
              <td className={cn(TD, "font-bold text-slate-800")} colSpan={hasAnyRubric ? 5 : 2}>
                <div className="flex items-center justify-between">
                  <span>Tổng điểm</span>
                  <span className="text-xs font-normal text-slate-400">Đã nhập: {filledCount}/{criteria.length} tiêu chí</span>
                </div>
              </td>
              <td className={cn(TD, "text-center")}>
                <p className={cn("text-base font-black", hasFilled ? "text-blue-700" : "text-slate-400")}>
                  {hasFilled ? totalCapped.toFixed(2) : "—"}
                </p>
                <p className="text-xs text-slate-400">/{maxTotal}</p>
                {hasCappedAny && <p className="text-xs text-amber-600 mt-0.5">Có TC đã giới hạn tối đa</p>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Điểm tổng & kết quả */}
      {showResult && (
        <div className={cn(
          "rounded-xl border-2 p-4 flex items-center justify-between",
          isPassed ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300",
        )}>
          <div className="flex items-center gap-3">
            {isPassed
              ? <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              : <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
            <div>
              <p className={cn("text-sm font-bold", isPassed ? "text-green-800" : "text-red-800")}>
                {isPassed ? "Đề tài ĐẠT yêu cầu" : "Đề tài CHƯA ĐẠT yêu cầu"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Điểm tổng = cộng các tiêu chí đã nhập · Ngưỡng đạt ≥ 5 · Tối đa 10
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn("text-4xl font-black", isPassed ? "text-green-700" : "text-red-700")}>
              {totalCapped.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400">/10</p>
          </div>
        </div>
      )}

      {/* Nhận xét chung — ẩn với hội đồng */}
      {role !== "COMMITTEE_MEMBER" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nhận xét chung</label>
          <textarea
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            rows={12}
            placeholder="Nhận xét tổng quát về bài khóa luận..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {/* Câu hỏi (chỉ hiển thị cho GVPB) */}
      {role === "REVIEWER" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Câu hỏi phản biện
            <span className="text-xs text-slate-400 font-normal ml-1">(tối thiểu 2 câu hỏi)</span>
          </label>
          <textarea
            value={cauHoi}
            onChange={(e) => setCauHoi(e.target.value)}
            rows={4}
            placeholder={"1. ...\n2. ..."}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!hasFilled || hasError}
        className="w-full"
        size="lg"
      >
        {existingScore !== undefined ? "Cập nhật điểm" : "Lưu điểm chấm"}
      </Button>
    </div>
  );
}
