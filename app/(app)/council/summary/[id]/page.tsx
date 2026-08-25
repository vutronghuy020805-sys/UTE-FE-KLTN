export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { calculateTotalScore, PASSING_SCORE, SUPERVISOR_PASSING_SCORE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { ShieldAlert, Lock, Download, FileText } from "lucide-react";
import { BienBanHdForm } from "./bien-ban-hd-form";
import { PresentationTimeInput } from "./presentation-time-input";

export default async function CouncilSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const topic = await db.topics.findById(id);
  if (!topic) notFound();

  const committee = await db.committees.findByTopic(id);
  if (!committee) redirect("/council/dashboard");

  // CHỈ thư ký mới được xem trang này
  if (committee.secretary_id !== userId) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500 mt-2">
          Trang tổng hợp điểm chỉ dành cho Thư ký hội đồng.
          Nếu bạn cần xem kết quả, vui lòng liên hệ Thư ký hội đồng.
        </p>
      </div>
    );
  }

  // Lấy toàn bộ dữ liệu
  const [student, supervisor, reviewer, allScores, revisions, assignment] = await Promise.all([
    db.users.findById(topic.student_id),
    topic.supervisor_id ? db.users.findById(topic.supervisor_id) : null,
    topic.reviewer_id ? db.users.findById(topic.reviewer_id) : null,
    db.scores.filter({ topic_id: id }),
    db.revisions.filter({ topic_id: id }),
    db.committeeTopics.findByTopic(id).catch(() => null),
  ]);

  const nhanXetHd = assignment?.nhan_xet_hd ?? "";
  const yeuCauChinhSua = assignment?.yeu_cau_chinh_sua ?? "";
  const presentationMinutesRaw = assignment?.presentation_minutes ?? "";
  const presentationMinutes = presentationMinutesRaw === "" ? null : parseFloat(presentationMinutesRaw);

  const svScore = allScores.find((s) => s.score_role === "SUPERVISOR");
  const pbScore = allScores.find((s) => s.score_role === "REVIEWER");
  // Dedupe: nếu cùng 1 scorer_id có nhiều row (do bug race condition cũ), giữ
  // row MỚI NHẤT (updated_at hoặc created_at lớn nhất).
  const committeeRaw = allScores.filter((s) => s.score_role === "COMMITTEE_MEMBER");
  const latestByScorer = new Map<string, typeof committeeRaw[0]>();
  for (const s of committeeRaw) {
    const existing = latestByScorer.get(s.scorer_id);
    if (!existing) {
      latestByScorer.set(s.scorer_id, s);
    } else {
      const newTs = s.updated_at ?? s.created_at ?? "";
      const oldTs = existing.updated_at ?? existing.created_at ?? "";
      if (newTs > oldTs) latestByScorer.set(s.scorer_id, s);
    }
  }
  const committeeScores = [...latestByScorer.values()];

  // Lấy tên từng thành viên HĐ
  const committeeMembers = await Promise.all(
    committeeScores.map(async (s) => {
      const user = await db.users.findById(s.scorer_id);
      return { ...s, scorerName: user?.full_name ?? "—" };
    })
  );

  // Tính tổng điểm (chỉ thư ký thấy)
  const totalScore = calculateTotalScore(
    svScore ? Number(svScore.score_value) : undefined,
    pbScore ? Number(pbScore.score_value) : undefined,
    committeeScores.map((s) => Number(s.score_value))
  );

  // Đếm số thành viên hội đồng (chair + members, không kể thư ký)
  const memberCount = [
    committee.chair_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].filter(Boolean).length;
  const allCommitteeScored = memberCount > 0 && committeeScores.length >= memberCount;

  // Thư ký được quyền soạn biên bản + nhập thời gian thuyết trình BẤT CỨ LÚC NÀO
  // trước HOAN_TAT, vì topic đã được xếp vào HĐ — Thư ký cần chuẩn bị trước buổi
  // bảo vệ. Chỉ khóa khi đã HOAN_TAT.
  const canFinalize = topic.current_status !== "HOAN_TAT";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
              🔐 Trang Thư ký hội đồng
            </span>
            {allCommitteeScored &&
            ["DA_CHAM_PHAN_BIEN", "CHO_HOI_DONG", "DANG_CHAM_HOI_DONG"].includes(
              topic.current_status,
            ) ? (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                ✓ Đã chấm xong — chờ thư ký
              </span>
            ) : (
              <TopicStatusBadge status={topic.current_status} type="KLTN" />
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            SV: {student?.full_name} · {student?.student_code} · Hội đồng: {committee.committee_name}
          </p>
        </div>
      </div>

      {/* TỔNG HỢP ĐIỂM - chỉ thư ký thấy */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Điểm GVHD */}
        <ScoreBlock
          label="Điểm GVHD (20%)"
          scorer={supervisor?.full_name ?? "—"}
          score={svScore ? Number(svScore.score_value) : null}
        />
        {/* Điểm GVPB */}
        <ScoreBlock
          label="Điểm GVPB (20%)"
          scorer={reviewer?.full_name ?? "—"}
          score={pbScore ? Number(pbScore.score_value) : null}
        />
        {/* Điểm HĐ */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Điểm Hội đồng (60%)
          </p>
          {committeeMembers.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Chưa có thành viên nào chấm</p>
          ) : (
            <div className="space-y-2">
              {committeeMembers.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-xs text-slate-600 truncate">{m.scorerName}</p>
                  <span className={`text-sm font-bold ${Number(m.score_value) >= PASSING_SCORE ? "text-green-600" : "text-red-600"}`}>
                    {Number(m.score_value).toFixed(1)}
                  </span>
                </div>
              ))}
              {committeeMembers.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">Trung bình HĐ</p>
                  <span className="text-sm font-bold text-blue-600">
                    {(committeeMembers.reduce((a, m) => a + Number(m.score_value), 0) / committeeMembers.length).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TỔNG ĐIỂM CUỐI */}
        {totalScore !== null ? (
          <div className={`rounded-xl p-5 border-2 flex flex-col justify-between ${totalScore >= PASSING_SCORE ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Điểm Final</p>
            </div>
            <div className="mt-3">
              <p className={`text-5xl font-black ${totalScore >= PASSING_SCORE ? "text-green-700" : "text-red-700"}`}>
                {totalScore.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">/ 10 điểm</p>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold mt-2 inline-block ${totalScore >= PASSING_SCORE ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
                {totalScore >= PASSING_SCORE ? "✓ ĐẠT" : "✗ KHÔNG ĐẠT"}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-center">
            <p className="text-xs text-slate-400 text-center italic">Chưa đủ dữ liệu để tính điểm tổng</p>
          </div>
        )}

        {/* Thời gian thuyết trình — thư ký nhập, hệ thống auto chấm tiêu chí Thời gian */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Thời gian thuyết trình
          </p>
          <p className="text-xs text-slate-400 mb-3">Auto chấm TC "Thời gian"</p>
          <PresentationTimeInput
            topicId={id}
            initialMinutes={presentationMinutes !== null && Number.isFinite(presentationMinutes) ? presentationMinutes : null}
            canEdit={canFinalize}
            compact
          />
        </div>
      </div>

{/* Biên bản GVPB (nếu GVPB đã chấm) */}
      {pbScore && (
        <Card title="Biên bản phản biện (GVPB)">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Biên bản chấm điểm phản biện
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  GVPB: {reviewer?.full_name ?? "—"} · Điểm: {Number(pbScore.score_value).toFixed(2)}/10
                </p>
              </div>
            </div>
            <a
              href={`/api/download/bb-gvpb/${id}`}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Tải biên bản
            </a>
          </div>
        </Card>
      )}

{/* Yêu cầu chỉnh sửa */}
      {revisions.length > 0 && (
        <Card title="Lịch sử chỉnh sửa">
          <div className="space-y-3">
            {revisions.map((r) => (
              <div key={r.id} className={`p-3 rounded-lg border ${r.is_approved === "true" ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                <p className="text-sm font-medium text-slate-800">{r.request_note}</p>
                <p className="text-xs text-slate-400 mt-1">{formatDate(r.created_at)}</p>
                {r.is_approved === "true" && <p className="text-xs text-green-600 mt-1">✓ Đã xác nhận</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Phiếu chấm hội đồng — ZIP 3 thành viên */}
      <Card title="Phiếu chấm của các thành viên hội đồng">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Phiếu chấm Word — gộp 3 thành viên</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tải ZIP gồm phiếu chấm của Chủ tịch và các Ủy viên hội đồng.
              </p>
            </div>
          </div>
          <a
            href={`/api/download/phieu-cham-hd-zip/${id}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Tải ZIP phiếu chấm
          </a>
        </div>
      </Card>

      {/* Biên bản hội đồng */}
      <Card title="Biên bản hội đồng">
        <BienBanHdForm
          topicId={id}
          initialNhanXet={nhanXetHd}
          initialYeuCau={yeuCauChinhSua}
          canEdit={canFinalize}
        />
      </Card>

      {/* Ghi chú cho thư ký */}
      {canFinalize && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          Sau khi lưu biên bản sẽ quay về trang tổng hợp. Bấm "Xác nhận điểm và gửi BBHD" ở đó để gửi đồng loạt cho các sinh viên.
        </div>
      )}
    </div>
  );
}

// Score block component
function ScoreBlock({ label, scorer, score, passingScore }: {
  label: string; scorer: string; score: number | null; passingScore?: number;
}) {
  // Chỉ tô màu đỏ/xanh khi có passingScore (GVPB), còn GVHD luôn xanh
  const colorClass = score === null
    ? ""
    : passingScore !== undefined
      ? score > passingScore ? "text-green-600" : "text-red-600"
      : "text-blue-700";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xs text-slate-400 mb-3">Chấm bởi: {scorer}</p>
      {score === null ? (
        <p className="text-sm text-slate-400 italic">Chưa chấm</p>
      ) : (
        <>
          <p className={`text-5xl font-bold ${colorClass}`}>
            {score.toFixed(1)}
          </p>
        </>
      )}
    </div>
  );
}
