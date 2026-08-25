export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card, EmptyState } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import {
  Activity, CheckCircle2, Clock, FileText,
  MapPin, Calendar, Users, ExternalLink, ListOrdered, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KLTN_STATUS_LABELS, calculateTotalScore, PASSING_SCORE, FILE_TYPE_LABELS } from "@/lib/constants";
import { BcttUploadSection } from "./bctt-upload-section";
import { RevisionUploadSection } from "../topics/[id]/revision-upload-section";
import { formatDate, formatFileSize } from "@/lib/utils";
import type { KltnStatus } from "@/types";

const PROCESS_STEPS: { status: KltnStatus; label: string; desc: string }[] = [
  { status: "CHO_GVHD_DUYET",     label: "GVHD xác nhận",          desc: "Giảng viên hướng dẫn xác nhận nhận hướng dẫn" },
  { status: "DANG_THUC_HIEN",     label: "Nộp bài",                 desc: "Sinh viên thực hiện và nộp bài khóa luận" },
  { status: "CHO_CHAM_HUONG_DAN", label: "GVHD đã upload bài",     desc: "GVHD đã nộp bài khóa luận lên hệ thống" },
  { status: "DA_CHAM_HUONG_DAN",  label: "GVHD đã chấm điểm: ĐẠT", desc: "Đạt điểm GVHD, chờ phân công phản biện" },
  { status: "CHO_CHAM_PHAN_BIEN", label: "GVPB chấm điểm",         desc: "Giảng viên phản biện chấm điểm" },
  { status: "DA_CHAM_PHAN_BIEN",  label: "GVPB đã chấm điểm: ĐẠT", desc: "Đạt điểm phản biện, chờ hội đồng" },
  { status: "CHO_HOI_DONG",       label: "Chờ bảo vệ",              desc: "Đã thành lập hội đồng, chờ ngày bảo vệ" },
  { status: "DANG_CHAM_HOI_DONG", label: "Hoàn tất bảo vệ",         desc: "Buổi bảo vệ đã diễn ra" },
  { status: "CAN_CHINH_SUA",      label: "Hoàn tất bảo vệ",         desc: "Buổi bảo vệ đã diễn ra, có thể cần chỉnh sửa theo yêu cầu HĐ" },
  { status: "CHO_GVHD_XAC_NHAN", label: "Chờ duyệt",                desc: "GVHD/Chủ tịch HĐ duyệt bản chỉnh sửa" },
  { status: "CHO_CHU_TICH_DUYET", label: "Chờ duyệt",               desc: "Chủ tịch hội đồng phê duyệt lần cuối" },
  { status: "HOAN_TAT",           label: "Hoàn tất",                desc: "Đã hoàn thành toàn bộ quy trình" },
];

// Quy trình rút gọn cho BCTT
const BCTT_PROCESS_STEPS: { status: string; label: string; desc: string }[] = [
  { status: "CHO_GVHD_DUYET",     label: "GVHD xác nhận",  desc: "Giảng viên hướng dẫn xác nhận nhận hướng dẫn" },
  { status: "DANG_THUC_HIEN",     label: "Nộp bài",        desc: "Sinh viên nộp báo cáo thực tập" },
  { status: "DA_NOP_BAO_CAO",     label: "GVHD chấm điểm", desc: "Giảng viên hướng dẫn chấm điểm bài nộp" },
  { status: "DA_CHAM_HUONG_DAN",  label: "Qua GVHD",       desc: "Đạt điểm GVHD" },
  { status: "HOAN_TAT",           label: "Hoàn tất",       desc: "Đã hoàn thành toàn bộ quy trình" },
];

// Map trạng thái BCTT → chỉ số bước
const BCTT_STATUS_TO_STEP: Record<string, number> = {
  "CHO_GVHD_DUYET":     0,
  "DANG_THUC_HIEN":     1,
  "DA_NOP_BAO_CAO":     2,
  "CHO_CHAM_HUONG_DAN": 2,
  "DA_CHAM_HUONG_DAN":  3,
  "HOAN_TAT":           4,
};

const STATUS_ORDER: KltnStatus[] = PROCESS_STEPS.map((s) => s.status);

function getStepIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status as KltnStatus);
  return idx === -1 ? 0 : idx;
}

function getBcttStepIndex(status: string): number {
  return BCTT_STATUS_TO_STEP[status] ?? 0;
}

export default async function StudentStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [topics, currentUser] = await Promise.all([
    db.topics.filter({ student_id: userId }),
    db.users.findById(userId),
  ]);
  topics.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (topics.length === 0) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Theo dõi trạng thái</h1>
          <p className="text-sm text-slate-500 mt-1">Tiến trình thực hiện khóa luận tốt nghiệp</p>
        </div>
        <Card>
          <EmptyState
            icon={<Activity className="w-7 h-7 text-slate-400" />}
            title="Bạn chưa có đề tài nào"
            description="Hãy đăng ký đề tài để bắt đầu theo dõi tiến trình."
            action={
              <Link href="/student/topics/register"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Đăng ký ngay
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const activeTopic =
    topics.find((t) => t.topic_type === "KLTN" && !["HOAN_TAT", "GVHD_TU_CHOI"].includes(t.current_status)) ??
    topics.find((t) => !["HOAN_TAT", "GVHD_TU_CHOI"].includes(t.current_status)) ??
    topics.find((t) => t.topic_type === "KLTN") ??
    topics[0];

  // Các đề tài BCTT đã hoàn tất (không phải activeTopic)
  const completedBcttTopics = topics.filter(
    (t) => t.topic_type === "BCTT" && t.current_status === "HOAN_TAT" && t.id !== activeTopic.id,
  );

  const [supervisor, , scores, revisions, files, committee, statusHistories, ...bcttExtras] = await Promise.all([
    activeTopic.supervisor_id ? db.users.findById(activeTopic.supervisor_id) : null,
    activeTopic.reviewer_id ? db.users.findById(activeTopic.reviewer_id) : null,
    db.scores.filter({ topic_id: activeTopic.id }),
    db.revisions.filter({ topic_id: activeTopic.id }),
    db.files.filter({ topic_id: activeTopic.id }),
    db.committees.findByTopic(activeTopic.id),
    db.statusHistories.filter({ topic_id: activeTopic.id }).catch(() => [] as Record<string, string>[]),
    ...completedBcttTopics.map(async (t) => {
      const sup = t.supervisor_id ? await db.users.findById(t.supervisor_id) : null;
      return { topic: t, supervisor: sup };
    }),
  ]);

  // Tìm lý do từ chối GẦN NHẤT (nếu có) — để SV biết phải sửa gì
  const rejectionHistories = (statusHistories as Record<string, string>[])
    .filter(
      (h) =>
        h.new_status === "CAN_CHINH_SUA" &&
        (h.old_status === "CHO_GVHD_XAC_NHAN" || h.old_status === "CHO_CHU_TICH_DUYET"),
    )
    .sort((a, b) => (b.changed_at ?? "").localeCompare(a.changed_at ?? ""));
  const latestRejection = rejectionHistories[0] ?? null;
  const rejectorRole = latestRejection
    ? latestRejection.old_status === "CHO_GVHD_XAC_NHAN"
      ? "GVHD"
      : "Chủ tịch Hội đồng"
    : null;
  const rejectionNote = latestRejection
    ? (latestRejection.note ?? "").replace(/^Chủ tịch HĐ từ chối:\s*/, "")
    : null;

  const isBCTT = activeTopic.topic_type === "BCTT";
  const processSteps = isBCTT ? BCTT_PROCESS_STEPS : PROCESS_STEPS;
  const currentStepIdx = isBCTT
    ? getBcttStepIndex(activeTopic.current_status)
    : getStepIndex(activeTopic.current_status);
  const isFailed = ["GVHD_TU_CHOI", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN"].includes(
    activeTopic.current_status,
  );

  // Điểm
  const supervisorScore = scores.find((s) => s.score_role === "SUPERVISOR");
  const reviewerScore = scores.find((s) => s.score_role === "REVIEWER");
  const committeeScores = scores.filter((s) => s.score_role === "COMMITTEE_MEMBER");
  const totalScore = calculateTotalScore(
    supervisorScore ? Number(supervisorScore.score_value) : undefined,
    reviewerScore ? Number(reviewerScore.score_value) : undefined,
    committeeScores.map((s) => Number(s.score_value)),
  );

  // Revision
  const pendingRevision = revisions.find((r) => r.is_approved !== "true" && !r.revised_file_id);
  const approvedRevision = revisions.find((r) => r.is_approved === "true");

  // Files biên bản hội đồng (do thư ký/sinh viên upload)
  const councilMinutesFiles = files.filter((f) => f.file_type === "BIEN_BAN_HOI_DONG");
  const feedbackFiles = files.filter((f) => f.file_type === "NHAN_XET_HOI_DONG");
  const turnitinFiles = files.filter((f) => f.file_type === "TURNITIN");
  const thesisFiles = files.filter((f) => f.file_type === "KHOA_LUAN");
  const chinhSuaFiles = files.filter((f) => f.file_type === "CHINH_SUA");
  const giaiTrinhFiles = files.filter((f) => f.file_type === "PHIEU_GIAI_TRINH");
  const otherFiles = files.filter((f) => !["BIEN_BAN_HOI_DONG", "NHAN_XET_HOI_DONG", "TURNITIN", "BAI_BAO", "KHOA_LUAN", "BAO_CAO", "XAC_NHAN", "CHINH_SUA", "PHIEU_GIAI_TRINH"].includes(f.file_type));
  const bcttFiles = files.filter((f) => f.file_type === "BAO_CAO");
  const xacNhanFiles = files.filter((f) => f.file_type === "XAC_NHAN");

  // Giai đoạn nào đã qua
  const hasCouncil = committee !== null;
  const inCouncilPhase = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG", "CAN_CHINH_SUA",
    "CHO_GVHD_XAC_NHAN", "CHO_CHU_TICH_DUYET", "HOAN_TAT"].includes(activeTopic.current_status);

  // Chair (chủ tịch) + tất cả assignments của HĐ này (để tính STT trình bày)
  const [chair, committeeAssignments] = await Promise.all([
    committee?.chair_id ? db.users.findById(committee.chair_id) : null,
    committee
      ? db.committeeTopics
          .filter({ committee_id: committee.id })
          .catch(() => [] as Record<string, string>[])
      : Promise.resolve([] as Record<string, string>[]),
  ]);

  // Sort theo order_index (fallback: created_at) — giống logic TBM xếp HĐ
  const sortedAssignments = [...committeeAssignments].sort((a, b) => {
    const oa = parseInt(a.order_index ?? "", 10);
    const ob = parseInt(b.order_index ?? "", 10);
    if (Number.isFinite(oa) && Number.isFinite(ob)) return oa - ob;
    if (Number.isFinite(oa)) return -1;
    if (Number.isFinite(ob)) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  const myIndex = sortedAssignments.findIndex((a) => a.topic_id === activeTopic.id);
  const myOrder = myIndex >= 0 ? myIndex + 1 : null;
  const totalInCommittee = sortedAssignments.length;

  let nextStudentName: string | null = null;
  let nextTopicTitle: string | null = null;
  if (myIndex >= 0 && myIndex + 1 < sortedAssignments.length) {
    const nextAssignment = sortedAssignments[myIndex + 1];
    const nextTopic = await db.topics.findById(nextAssignment.topic_id).catch(() => null);
    if (nextTopic) {
      nextTopicTitle = nextTopic.title ?? null;
      if (nextTopic.student_id) {
        const nextStudent = await db.users.findById(nextTopic.student_id).catch(() => null);
        nextStudentName = nextStudent?.full_name ?? null;
      }
    }
  }

  return (
    <div className="space-y-3 max-w-5xl">
      <h1 className="text-lg font-bold text-slate-900">Theo dõi trạng thái</h1>

      {/* BCTT đã hoàn tất */}
      {completedBcttTopics.length > 0 && (
        <div className="space-y-2">
          {(bcttExtras as Array<{ topic: typeof completedBcttTopics[0]; supervisor: Record<string, string> | null }>).map(({ topic, supervisor: bcttSup }) => (
            <div key={topic.id} className="bg-white rounded-xl border border-green-200 p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">Báo cáo thực tập</span>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Hoàn tất</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{topic.title}</p>
                <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-400">
                  <span>GVHD: {bcttSup?.full_name ?? "—"}</span>
                  <span>Đăng ký: {formatDate(topic.created_at)}</span>
                  {topic.academic_year && <span>Năm học: {topic.academic_year}</span>}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Thông tin đề tài */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{activeTopic.topic_type}</span>
              <TopicStatusBadge status={activeTopic.current_status} type="KLTN" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 leading-snug">{activeTopic.title}</h2>
            <div className="flex flex-wrap gap-x-4 mt-1.5 text-xs text-slate-400">
              <span>GVHD: {supervisor?.full_name ?? "—"}</span>
              <span>Đăng ký: {formatDate(activeTopic.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">

          {/* Thông tin hội đồng */}
          {hasCouncil && inCouncilPhase && (
            <div>
              <div className="space-y-3">
                <Card title="Thông tin Hội đồng bảo vệ">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Users className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium">{committee.committee_name}</span>
                    </div>
                    {committee.defense_date && (() => {
                      const dStr = committee.defense_date;
                      const d = new Date(dStr.includes("T") ? dStr : dStr + "T00:00:00");
                      const dateText = d.toLocaleDateString("vi-VN", {
                        weekday: "long", day: "2-digit", month: "long", year: "numeric",
                      });
                      const timeText =
                        committee.defense_session === "MORNING" ? "7h30 (sáng)"
                        : committee.defense_session === "AFTERNOON" ? "13h30 (chiều)"
                        : "";
                      return (
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>
                            <span className="text-slate-500 text-xs mr-1">Ngày bảo vệ:</span>
                            {timeText && <>lúc <span className="font-semibold">{timeText}</span>, </>}
                            {dateText}
                          </span>
                        </div>
                      );
                    })()}
                    {committee.defense_location && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <MapPin className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          <span className="text-slate-500 text-xs mr-1">Địa điểm:</span>
                          {committee.defense_location}
                        </span>
                      </div>
                    )}
                    {!committee.defense_date && !committee.defense_location && (
                      <p className="text-xs text-slate-400 italic">Ngày và địa điểm bảo vệ chưa được cập nhật.</p>
                    )}
                    {myOrder !== null && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <ListOrdered className="w-4 h-4 text-violet-400 shrink-0" />
                        <span>
                          <span className="text-slate-500 text-xs mr-1">STT trình bày:</span>
                          <span className="font-semibold text-violet-700">{myOrder}</span>
                          {totalInCommittee > 0 && (
                            <span className="text-slate-400"> / {totalInCommittee}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {nextStudentName ? (
                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <span>
                          <span className="text-slate-500 text-xs mr-1">Sau bạn:</span>
                          <span className="font-medium">{nextStudentName}</span>
                          {nextTopicTitle && (
                            <span className="text-slate-400 text-xs"> — {nextTopicTitle}</span>
                          )}
                        </span>
                      </div>
                    ) : myOrder !== null && myOrder === totalInCommittee && totalInCommittee > 1 ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500 italic">
                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                        <span>Bạn là người trình bày cuối cùng.</span>
                      </div>
                    ) : null}
                    {chair && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Chủ tịch HĐ</span>
                        <span>{chair.full_name}</span>
                      </div>
                    )}
                  </div>
                </Card>
                {/* Kết quả đạo văn + Hồ sơ đã nộp nằm dưới Thông tin HĐ khi CAN_CHINH_SUA */}
                {activeTopic.current_status === "CAN_CHINH_SUA" && turnitinFiles.length > 0 && (
                  <Card title="Kết quả kiểm tra đạo văn (Turnitin)">
                    <div className="space-y-2">
                      {turnitinFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                              <p className="text-xs text-slate-400">Upload bởi GVHD · {formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                            <ExternalLink className="w-3.5 h-3.5" /> Xem
                          </a>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {activeTopic.current_status === "CAN_CHINH_SUA" && (thesisFiles.length > 0 || otherFiles.length > 0 || bcttFiles.length > 0 || xacNhanFiles.length > 0) && (
                  <Card title={`Hồ sơ đã nộp (${thesisFiles.length + otherFiles.length + bcttFiles.length + xacNhanFiles.length} file)`}>
                    <div className="space-y-2">
                      {[...thesisFiles, ...bcttFiles, ...xacNhanFiles, ...otherFiles].map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{f.original_name}</p>
                              <p className="text-xs text-slate-400">
                                {FILE_TYPE_LABELS[f.file_type as keyof typeof FILE_TYPE_LABELS]} · {formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}
                              </p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                            <ExternalLink className="w-3.5 h-3.5" /> Xem
                          </a>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {councilMinutesFiles.length > 0 && (
                  <Card title="Biên bản Hội đồng">
                    <div className="space-y-2">
                      {councilMinutesFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                            <ExternalLink className="w-3.5 h-3.5" /> Xem
                          </a>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Lý do từ chối gần nhất — SV biết phải sửa gì */}
          {latestRejection && rejectorRole && rejectionNote && (
            <Card title={`⚠️ ${rejectorRole} yêu cầu chỉnh sửa thêm`}>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Người yêu cầu: <span className="font-semibold text-slate-700">{rejectorRole}</span>
                </p>
                <div className="bg-red-50 border-l-4 border-red-400 rounded-r-lg px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">
                    Nội dung cần chỉnh sửa
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {rejectionNote}
                  </p>
                </div>
                <p className="text-xs text-slate-400 italic">
                  Vui lòng upload lại bộ tài liệu chỉnh sửa bên dưới sau khi đã sửa theo yêu cầu.
                </p>
              </div>
            </Card>
          )}

          {/* SV nộp tài liệu chỉnh sửa — hiện cho MỌI status KLTN trừ HOAN_TAT.
              Nếu đã nộp rồi (CHO_GVHD_XAC_NHAN/CHO_CHU_TICH_DUYET/CHO_THU_KY_XAC_NHAN),
              SV vẫn upload lại được (file đè) trong khi chờ duyệt — không cần Gửi lại. */}
          {activeTopic.current_status !== "HOAN_TAT" && activeTopic.topic_type === "KLTN" && (
            <Card title="📎 Nộp tài liệu chỉnh sửa">
              <RevisionUploadSection
                topicId={activeTopic.id}
                initialHasChinhSua={chinhSuaFiles.length > 0}
                initialHasGiaiTrinh={giaiTrinhFiles.length > 0}
                alreadySubmitted={[
                  "CHO_GVHD_XAC_NHAN",
                  "CHO_CHU_TICH_DUYET",
                  "CHO_THU_KY_XAC_NHAN",
                ].includes(activeTopic.current_status)}
              />
            </Card>
          )}

          {/* Nhận xét góp ý từ hội đồng */}
          {feedbackFiles.length > 0 && (
            <Card title="Nhận xét góp ý từ Hội đồng">
              <div className="space-y-2">
                {feedbackFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                      <ExternalLink className="w-3.5 h-3.5" /> Xem
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Điểm sau khi bảo vệ — hiện từ khi thư ký gửi BBHD trở đi */}
          {[
            "CAN_CHINH_SUA",
            "DA_NOP_BAN_CHINH_SUA",
            "CHO_GVHD_XAC_NHAN",
            "CHO_CHU_TICH_DUYET",
            "CHO_THU_KY_XAC_NHAN",
            "HOAN_TAT",
          ].includes(activeTopic.current_status) && totalScore !== null && (
            <Card title="Kết quả sau khi bảo vệ">
              <div className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                totalScore >= PASSING_SCORE ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
              }`}>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Kết quả bảo vệ khóa luận</p>
                  <p className="text-xs text-slate-500 mt-0.5">Đã được Hội đồng và Thư ký xác nhận</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-3xl font-black leading-none ${
                      totalScore >= PASSING_SCORE ? "text-green-700" : "text-red-700"
                    }`}>
                      {totalScore.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">/ 10 điểm</p>
                  </div>
                  <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${
                    totalScore >= PASSING_SCORE ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {totalScore >= PASSING_SCORE ? "✓ ĐẠT" : "✗ KHÔNG ĐẠT"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Kết quả kiểm tra đạo văn */}
          {activeTopic.current_status !== "CAN_CHINH_SUA" && turnitinFiles.length > 0 && (
            <Card title="Kết quả kiểm tra đạo văn (Turnitin)">
              <div className="space-y-2">
                {turnitinFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                        <p className="text-xs text-slate-400">Upload bởi GVHD · {formatDate(f.uploaded_at)}</p>
                      </div>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      <ExternalLink className="w-3.5 h-3.5" /> Xem
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Nộp file BCTT */}
          {isBCTT && ["DANG_THUC_HIEN", "DA_NOP_BAO_CAO"].includes(activeTopic.current_status) && (
            <Card title="Nộp hồ sơ thực tập">
              <BcttUploadSection
                topicId={activeTopic.id}
                hasBaoCao={bcttFiles.length > 0}
                hasXacNhan={xacNhanFiles.length > 0}
                mssv={currentUser?.student_code ?? ""}
                major={currentUser?.major ?? ""}
              />
            </Card>
          )}

          {/* Hồ sơ đã nộp */}
          {activeTopic.current_status !== "CAN_CHINH_SUA" && (thesisFiles.length > 0 || otherFiles.length > 0 || bcttFiles.length > 0 || xacNhanFiles.length > 0) && !["DANG_THUC_HIEN", "DA_NOP_BAO_CAO"].includes(activeTopic.current_status) && (
            <Card title={`Hồ sơ đã nộp (${thesisFiles.length + otherFiles.length + bcttFiles.length + xacNhanFiles.length} file)`}>
              <div className="space-y-2">
                {[...thesisFiles, ...bcttFiles, ...xacNhanFiles, ...otherFiles].map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{f.original_name}</p>
                        <p className="text-xs text-slate-400">
                          {FILE_TYPE_LABELS[f.file_type as keyof typeof FILE_TYPE_LABELS]} · {formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      <ExternalLink className="w-3.5 h-3.5" /> Xem
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Trạng thái chỉnh sửa sau bảo vệ */}
          {(pendingRevision || approvedRevision) && (
            <Card title="Chỉnh sửa sau bảo vệ">
              <div className="space-y-3">
                {pendingRevision && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-orange-800">Yêu cầu chỉnh sửa từ Hội đồng</p>
                        <p className="text-xs text-orange-700 mt-0.5">{pendingRevision.request_note}</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTopic.current_status === "CHO_GVHD_XAC_NHAN" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm text-amber-800">Đang chờ GVHD xác nhận tài liệu chỉnh sửa</p>
                    </div>
                  </div>
                )}
                {activeTopic.current_status === "CHO_CHU_TICH_DUYET" && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500 shrink-0" />
                      <p className="text-sm text-purple-800">GVHD đã xác nhận — đang chờ Chủ tịch HĐ phê duyệt lần cuối</p>
                    </div>
                  </div>
                )}
                {approvedRevision && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <p className="text-sm text-green-800 font-medium">GVHD và Chủ tịch HĐ đã đồng ý — hoàn tất chỉnh sửa</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

      </div>
    </div>
  );
}
