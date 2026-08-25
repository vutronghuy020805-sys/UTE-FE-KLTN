export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { CriteriaScoreForm } from "@/components/domain/criteria-score-form";
import type { CriterionDef } from "@/components/domain/criteria-score-form";
import { FileUpload } from "@/components/domain/file-upload";
import { PASSING_SCORE, SUPERVISOR_MAX_SCORE, FILE_TYPE_LABELS, SHEET_NAMES, computeTimeScore } from "@/lib/constants";
import { fetchCriteriaSheet } from "@/lib/sheets/client";
import { formatDate, formatFileSize } from "@/lib/utils";
import { ExternalLink, FileText, ShieldAlert, Eye, Download } from "lucide-react";
import Link from "next/link";
import { ChairApproveButton, ChairRejectButton } from "./chair-approve-button";

export default async function CouncilTopicDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const topic = await db.topics.findById(id);
  if (!topic) notFound();

  // Đọc tiêu chí chấm điểm hội đồng từ Google Sheets (1 bộ tiêu chí chung)
  let committeeCriteria: CriterionDef[] = [];
  if (topic.topic_type === "KLTN") {
    try {
      const rows = await fetchCriteriaSheet(SHEET_NAMES.BB_HD);
      committeeCriteria = rows.map((r, i) => ({
        key: `tc${i + 1}`,
        label: r.label,
        maxScore: r.maxScore,
        ...(r.rubric ? { rubric: r.rubric } : {}),
      }));
    } catch { /* dùng tiêu chí mặc định nếu sheet chưa có */ }
  }

  // Kiểm tra user có trong hội đồng không
  const committee = await db.committees.findByTopic(id);
  if (!committee) redirect("/council/dashboard");

  const isInCommittee = [
    committee.secretary_id,
    committee.chair_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].includes(userId);

  if (!isInCommittee) redirect("/council/dashboard");

  // Kiểm tra điều kiện cả GVHD và GVPB đã chấm > ngưỡng
  const scores = await db.scores.filter({ topic_id: id });
  const svScore = scores.find((s) => s.score_role === "SUPERVISOR");
  const pbScore = scores.find((s) => s.score_role === "REVIEWER");

  const bothPassed = svScore && pbScore;

  if (!bothPassed) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Hồ sơ chưa sẵn sàng</h2>
        <p className="text-sm text-slate-500 mt-2">
          Hội đồng chỉ được xem hồ sơ khi cả GVHD và GVPB đã chấm điểm đạt ({">"} {PASSING_SCORE}).
        </p>
      </div>
    );
  }

  const isSecretary = committee.secretary_id === userId;
  const isChair = committee.chair_id === userId;
  const [student, files, assignment] = await Promise.all([
    db.users.findById(topic.student_id),
    db.files.filter({ topic_id: id }),
    db.committeeTopics.findByTopic(id).catch(() => null),
  ]);

  // Thư ký nhập "Thời gian thuyết trình" → tính điểm tự động cho tiêu chí "Thời gian"
  const minutesRaw = assignment?.presentation_minutes ?? "";
  const minutes = minutesRaw === "" ? null : parseFloat(minutesRaw);
  const autoTimeScore = computeTimeScore(minutes);

  // Điểm của chính mình trong HĐ
  const myCommitteeScore = scores.find(
    (s) => s.score_role === "COMMITTEE_MEMBER" && s.scorer_id === userId
  );

  // Thư ký không chấm; chủ tịch và thành viên được chấm trong giai đoạn hội đồng.
  // Defensive: nếu data lệch (đề tài đã trong HĐ nhưng status còn ở pha phản biện),
  // vẫn cho TV/CT HĐ chấm. Trang này đã require isInCommittee = true nên an toàn.
  // TV HĐ được phép chấm sớm bất cứ lúc nào topic đã có HĐ (đã verify ở trên)
  // và CHƯA bước qua giai đoạn sau bảo vệ (chỉnh sửa/chủ tịch duyệt/hoàn tất).
  // Cho phép cả khi GVHD/GVPB chưa chấm — TBM có thể xếp HĐ sớm.
  const SCORE_LOCKED_STATUS = [
    "HOAN_TAT",
    "CAN_CHINH_SUA",
    "CHO_THU_KY_XAC_NHAN",
    "CHO_CHU_TICH_DUYET",
    "CHO_GVHD_XAC_NHAN",
    "DA_NOP_BAN_CHINH_SUA",
  ];
  const canScore = !isSecretary && !SCORE_LOCKED_STATUS.includes(topic.current_status);
  // Hiện điểm read-only sau khi thư ký đã gửi biên bản
  const scoreLocked = !isSecretary && SCORE_LOCKED_STATUS.includes(topic.current_status);
  const relevantFiles = files.filter((f) => ["KHOA_LUAN", "TURNITIN", "BAI_BAO"].includes(f.file_type));
  const feedbackFiles = files.filter((f) => f.file_type === "NHAN_XET_HOI_DONG");

  // Files chỉnh sửa GVHD gửi cho Chủ tịch (CHO_CHU_TICH_DUYET) — chỉ lấy file
  // mới nhất theo uploaded_at (SV có thể upload nhiều lần, file sau đè trước)
  const pickLatestOfType = (type: string) =>
    files
      .filter((f) => f.file_type === type)
      .sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))
      .slice(0, 1);
  const chinhSuaFiles = pickLatestOfType("CHINH_SUA");
  const giaiTrinhFiles = pickLatestOfType("PHIEU_GIAI_TRINH");
  const bbhdFiles = pickLatestOfType("BIEN_BAN_HOI_DONG");
  const canChairApprove = isChair && topic.current_status === "CHO_CHU_TICH_DUYET";
  const canChairFinalize = isChair && ["CAN_CHINH_SUA", "CHO_THU_KY_XAC_NHAN"].includes(topic.current_status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TopicStatusBadge status={topic.current_status} type="KLTN" />
            {isSecretary && (
              <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                Bạn là Thư ký hội đồng
              </span>
            )}
            {isChair && (
              <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                Bạn là Chủ tịch hội đồng
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
          <p className="text-sm text-slate-500 mt-1">SV: {student?.full_name} · {student?.student_code}</p>
        </div>
        {isSecretary && (
          <Link
            href={`/council/summary/${id}`}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem tổng hợp điểm
          </Link>
        )}
      </div>

      {/* ====== TÀI LIỆU KHÓA LUẬN + PHÊ DUYỆT (side by side khi canChairApprove) ====== */}
      <div className={canChairApprove ? "grid grid-cols-2 gap-6 items-start" : ""}>
        <div className={canChairApprove ? "space-y-6" : ""}>
        <Card title="Tài liệu khóa luận">
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
                        {FILE_TYPE_LABELS[f.file_type as keyof typeof FILE_TYPE_LABELS]} · {formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}
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
        {canChairApprove && (
          <Card title="Thông tin sinh viên & đề tài">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Họ và tên</dt>
                <dd className="font-semibold text-slate-800">{student?.full_name}</dd>
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
                  <dd className="text-slate-600">{topic.summary}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}
        </div>
        {canChairApprove && (
          <div className="space-y-6">
          <Card title="🏁 Phê duyệt hoàn tất — Chủ tịch Hội đồng">
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-700">
                GVHD đã xác nhận và chuyển 2 file chỉnh sửa của sinh viên. Vui lòng xem lại và phê duyệt lần cuối.
              </div>
              {[
                { label: "Biên bản Hội đồng", fList: bbhdFiles, color: "amber" },
                { label: "KLTN đã chỉnh sửa", fList: chinhSuaFiles, color: "blue" },
                { label: "Biên bản giải trình", fList: giaiTrinhFiles, color: "green" },
              ].map(({ label, fList, color }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
                  {fList.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Chưa có file</p>
                  ) : (
                    <div className="space-y-1.5">
                      {fList.map((f) => (
                        <div key={f.id} className={`flex items-center justify-between p-3 bg-${color}-50 border border-${color}-200 rounded-lg`}>
                          <div className="flex items-center gap-3">
                            <FileText className={`w-4 h-4 text-${color}-500 shrink-0`} />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                            <ExternalLink className="w-3.5 h-3.5" /> Tải về & xem
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {chinhSuaFiles.length > 0 && giaiTrinhFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    <ChairApproveButton topicId={id} />
                    <ChairRejectButton topicId={id} />
                  </div>
                ) : (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Cần có đủ 2 file (KLTN đã chỉnh sửa và Biên bản giải trình) trước khi phê duyệt.
                  </p>
                )}
              </div>
            </div>
          </Card>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-2">Hội đồng: {committee.committee_name}</p>
            <p className="text-slate-400">Để xem điểm tổng hợp và tổng kết, vui lòng liên hệ Thư ký hội đồng.</p>
          </div>
          </div>
        )}
      </div>

      {/* ====== CHẤM ĐIỂM HỘI ĐỒNG — full width ====== */}
      {canScore && (
        <Card title={myCommitteeScore
          ? `✏️ Cập nhật điểm hội đồng${isChair ? " (Chủ tịch)" : ""}`
          : `⭐ Nhập điểm hội đồng${isChair ? " (Chủ tịch)" : ""}`
        }>
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ℹ️ Điểm tổng kết cuối chỉ được xem bởi Thư ký hội đồng.
          </div>
          <CriteriaScoreForm
            topicId={id}
            role="COMMITTEE_MEMBER"
            customCriteria={committeeCriteria.length > 0 ? committeeCriteria : undefined}
            existingScore={myCommitteeScore ? Number(myCommitteeScore.score_value) : undefined}
            existingComment={myCommitteeScore?.comment}
            autoTimeScore={autoTimeScore}
          />
        </Card>
      )}

      {/* Tải phiếu chấm Word — TV/CT đã chấm */}
      {!isSecretary && myCommitteeScore && (
        <Card title="📄 Phiếu chấm của tôi">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Phiếu chấm khóa luận</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điểm tổng: {Number(myCommitteeScore.score_value).toFixed(2)}/10
                  {scoreLocked && " · Đã khóa"}
                </p>
              </div>
            </div>
            <a
              href={`/api/download/phieu-cham-hd/${id}/${userId}`}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Tải phiếu chấm (Word)
            </a>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          {/* Thông tin sinh viên — ẩn khi đã hiện ở cột trái (canChairApprove) */}
          {!canChairApprove && <Card title="Thông tin sinh viên & đề tài">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Họ và tên</dt>
                <dd className="font-semibold text-slate-800">{student?.full_name}</dd>
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
                  <dd className="text-slate-600">{topic.summary}</dd>
                </div>
              )}
            </dl>
          </Card>}

        </div>

        {/* Sidebar — ẩn khi đã hiện ở cột phải (canChairApprove) */}
        {!canChairApprove && (
          <div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              <p className="font-medium text-slate-600 mb-2">Hội đồng: {committee.committee_name}</p>
              <p className="text-slate-400">Để xem điểm tổng hợp và tổng kết, vui lòng liên hệ Thư ký hội đồng.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
