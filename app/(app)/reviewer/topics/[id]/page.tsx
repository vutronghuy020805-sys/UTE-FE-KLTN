export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { CriteriaScoreForm } from "@/components/domain/criteria-score-form";
import type { CriterionDef } from "@/components/domain/criteria-score-form";
import { FILE_TYPE_LABELS, SHEET_NAMES, PASSING_SCORE } from "@/lib/constants";
import { fetchCriteriaSheet } from "@/lib/sheets/client";
import { formatFileSize } from "@/lib/utils";
import { ExternalLink, FileText, Download } from "lucide-react";
import { SendBBToSecretaryButton } from "./send-bb-button";

export default async function ReviewerTopicDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const topic = await db.topics.findById(id);
  if (!topic) notFound();

  // Kiểm tra quyền: phải là GVPB của topic này
  if (topic.reviewer_id !== userId) redirect("/reviewer/dashboard");

  // Đọc tiêu chí chấm điểm từ Google Sheets theo loại đề tài
  let reviewerCriteria: CriterionDef[] = [];
  {
    const sheetName = topic.topic_category === "NGHIEN_CUU"
      ? SHEET_NAMES.BB_GVPB_NGHIEN_CUU
      : SHEET_NAMES.BB_GVPB_UNG_DUNG;
    try {
      const rows = await fetchCriteriaSheet(sheetName);
      reviewerCriteria = rows.map((r, i) => ({
        key: `tc${i + 1}`,
        label: r.label,
        maxScore: r.maxScore,
        ...(r.rubric ? { rubric: r.rubric } : {}),
      }));
    } catch { /* dùng tiêu chí mặc định nếu sheet chưa có */ }
  }

  const [student, files, myScore, supervisorScores] = await Promise.all([
    db.users.findById(topic.student_id),
    db.files.filter({ topic_id: id }),
    db.scores.filter({ topic_id: id, scorer_id: userId, score_role: "REVIEWER" }),
    db.scores.filter({ topic_id: id, score_role: "SUPERVISOR" }),
  ]);

  const existingScore = myScore[0] ?? null;
  const supervisorHasScored = supervisorScores.length > 0 && Number(supervisorScores[0].score_value) >= PASSING_SCORE;
  // GVPB chỉ chấm được khi GVHD đã chấm đạt, hoặc đã có điểm PB rồi (để cập nhật)
  const canScore = supervisorHasScored || !!existingScore;

  // Lọc file liên quan (bài khóa luận, Turnitin, Bài báo nếu có)
  const relevantFiles = files.filter((f) =>
    ["KHOA_LUAN", "TURNITIN", "BAI_BAO"].includes(f.file_type)
  );

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <TopicStatusBadge status={topic.current_status} type="KLTN" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          SV: {student?.full_name} · {student?.student_code}
        </p>
      </div>

      {/* Bài khóa luận & Turnitin — ngay sau tiêu đề */}
      <Card title="Bài khóa luận & Turnitin">
        {relevantFiles.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Chưa có file nào</p>
        ) : (
          <div className="space-y-2">
            {relevantFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                    <p className="text-xs text-slate-400">
                      {FILE_TYPE_LABELS[f.file_type as keyof typeof FILE_TYPE_LABELS]} · {formatFileSize(Number(f.file_size))}
                    </p>
                  </div>
                </div>
                <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> Tải về
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Chấm điểm — full width */}
      {canScore ? (
        <Card title={existingScore ? "Cập nhật điểm phản biện" : "Nhập điểm phản biện"}>
          <CriteriaScoreForm
            topicId={id}
            role="REVIEWER"
            existingScore={existingScore ? Number(existingScore.score_value) : undefined}
            existingComment={existingScore?.comment}
            customCriteria={reviewerCriteria.length > 0 ? reviewerCriteria : undefined}
          />
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-3 py-4 text-sm text-amber-700 bg-amber-50 rounded-lg px-4">
            <span>⏳</span>
            <p>Chờ giảng viên hướng dẫn chấm điểm đạt trước khi bạn có thể phản biện.</p>
          </div>
        </Card>
      )}

      {/* Nút tải biên bản + gửi cho thư ký (nếu đã chấm) */}
      {existingScore && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href={`/api/download/bb-gvpb/${id}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Tải biên bản Word
          </a>
          <SendBBToSecretaryButton topicId={id} />
        </div>
      )}

      {/* Thông tin đề tài */}
      <Card title="Thông tin đề tài">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Sinh viên</dt>
            <dd className="font-medium text-slate-800">{student?.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">MSSV</dt>
            <dd className="text-slate-700">{student?.student_code}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Khoa / Ngành</dt>
            <dd className="text-slate-700">{student?.department} / {student?.major}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Lĩnh vực</dt>
            <dd className="text-slate-700">{topic.field}</dd>
          </div>
          {topic.summary && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400 mb-0.5">Mô tả</dt>
              <dd className="text-slate-700">{topic.summary}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
