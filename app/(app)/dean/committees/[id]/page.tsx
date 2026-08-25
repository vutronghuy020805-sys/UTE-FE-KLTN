export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/index";
import { Calendar, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CommitteeTopicsSection } from "@/app/(app)/dean/committees/[id]/committee-topics-section";
import { EditCommitteeForm } from "@/app/(app)/dean/committees/[id]/edit-committee-form";
import { DeleteCommitteeButton } from "@/app/(app)/dean/committees/[id]/delete-committee-button";
import { getDeanScopeMajor } from "@/lib/permissions";
import { autoPassUngradedGVHD } from "@/app/actions/topic.actions";

export default async function CommitteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Auto-pass GVHD trước khi tính pending list — đồng bộ với /dean/committees
  try {
    await autoPassUngradedGVHD();
  } catch {
    /* silent */
  }

  const [committee, allTopics, allUsers, allAssignments, allCommittees, allScores, scopeMajor] = await Promise.all([
    db.committees.findById(id).catch(() => null),
    db.topics.getAll(),
    db.users.getAll(),
    db.committeeTopics.filter({ committee_id: id }).catch(() => [] as Record<string, string>[]),
    db.committees.getAll().catch(() => [] as Record<string, string>[]),
    db.scores.getAll().catch(() => [] as Record<string, string>[]),
    getDeanScopeMajor(),
  ]);

  // Đề tài được GVHD auto-pass (hệ thống cho 5đ)
  const AUTO_PASS_COMMENT = "Điểm mặc định (hệ thống tự động)";
  const autoPassedTopicIds = new Set(
    allScores
      .filter((s) => s.score_role === "SUPERVISOR" && s.comment_text === AUTO_PASS_COMMENT)
      .map((s) => s.topic_id),
  );

  // Map topic_id → điểm GVHD (đã chấm)
  const supervisorScoreByTopicId = new Map<string, number>();
  for (const s of allScores) {
    if (s.score_role !== "SUPERVISOR") continue;
    const v = Number(s.score_value);
    if (Number.isFinite(v)) supervisorScoreByTopicId.set(s.topic_id, v);
  }

  // Map topic_id → điểm GVPB (đã chấm)
  const reviewerScoreByTopicId = new Map<string, number>();
  for (const s of allScores) {
    if (s.score_role !== "REVIEWER") continue;
    const v = Number(s.score_value);
    if (Number.isFinite(v)) reviewerScoreByTopicId.set(s.topic_id, v);
  }

  // Đề tài có điểm GVHD < 5 (không đạt) — TBM không nên xếp hội đồng
  const gvhdFailedTopicIds = new Set(
    [...supervisorScoreByTopicId.entries()]
      .filter(([, v]) => v < 5)
      .map(([id]) => id),
  );

  if (!committee) notFound();

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const allLecturers = allUsers.filter((u) => ["LECTURER", "DEAN"].includes(u.system_role));

  // GV cùng ngành — dùng cho chủ tịch/thành viên; tất cả — cho thư ký
  const sameMajorLecturers = scopeMajor
    ? allLecturers.filter((l) => (l.major || l.department || "").trim() === scopeMajor)
    : allLecturers;
  const lecturerOptions = sameMajorLecturers.map((l) => ({ value: l.id, label: l.full_name }));
  const secretaryLecturerOptions = allLecturers.map((l) => ({ value: l.id, label: l.full_name }));

  // Member IDs của hội đồng này
  const memberIds = [
    committee.chair_id,
    committee.secretary_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].filter(Boolean);

  // Đề tài đã được add vào HĐ này — sort theo order_index (fallback: created_at)
  const assignedTopicIds = new Set(allAssignments.map((a) => a.topic_id));
  const sortedAssignments = [...allAssignments].sort((a, b) => {
    const oa = parseInt(a.order_index ?? "", 10);
    const ob = parseInt(b.order_index ?? "", 10);
    if (Number.isFinite(oa) && Number.isFinite(ob)) return oa - ob;
    if (Number.isFinite(oa)) return -1;
    if (Number.isFinite(ob)) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  const assignedTopics = sortedAssignments.map((a) => {
    const topic = allTopics.find((t) => t.id === a.topic_id);
    if (!topic) return null;
    return {
      assignmentId: a.id,
      topic,
      student: userMap.get(topic.student_id) ?? null,
      supervisor: topic.supervisor_id ? userMap.get(topic.supervisor_id) ?? null : null,
      reviewer: topic.reviewer_id ? userMap.get(topic.reviewer_id) ?? null : null,
      gvhdFailed: gvhdFailedTopicIds.has(topic.id),
      gvhdScore: supervisorScoreByTopicId.get(topic.id),
      gvpbScore: reviewerScoreByTopicId.get(topic.id),
    };
  }).filter(Boolean) as Array<{
    assignmentId: string;
    topic: Record<string, string>;
    student: Record<string, string> | null;
    supervisor: Record<string, string> | null;
    reviewer: Record<string, string> | null;
    gvhdFailed: boolean;
    gvhdScore: number | undefined;
    gvpbScore: number | undefined;
  }>;

  // Đề tài chờ xếp HĐ (chưa có HĐ nào) — auto-suggest: GVPB là thành viên HĐ này
  const allAssignedIds = new Set(
    (await db.committeeTopics.getAll().catch(() => [] as Record<string, string>[])).map((a) => a.topic_id)
  );
  // Đồng bộ với /dean/committees (list): TẤT CẢ đề tài đã đăng ký, chưa có HĐ,
  // chưa kết thúc. Đề tài KHONG_DAT_* vẫn show để tô đỏ trong UI.
  const INELIGIBLE_STATUSES = [
    "HOAN_TAT",
    "GVHD_TU_CHOI",
    "MOI_DANG_KY",
    "CHO_GVHD_DUYET",
    "CHO_TRUONG_KHOA_DUYET",
  ];
  const pendingTopics = allTopics
    .filter(
      (t) =>
        !allAssignedIds.has(t.id) &&
        !INELIGIBLE_STATUSES.includes(t.current_status),
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      student: userMap.get(t.student_id) ?? null,
      supervisor: t.supervisor_id ? userMap.get(t.supervisor_id) ?? null : null,
      reviewer: t.reviewer_id ? userMap.get(t.reviewer_id) ?? null : null,
      isSuggested: t.reviewer_id ? memberIds.includes(t.reviewer_id) : false,
      isAutoPass: autoPassedTopicIds.has(t.id),
      gvhdFailed: gvhdFailedTopicIds.has(t.id),
      gvhdScore: supervisorScoreByTopicId.get(t.id),
      gvpbScore: reviewerScoreByTopicId.get(t.id),
    }));

  // GV đã bận theo (ngày + buổi) để filter khi edit
  // Key = "YYYY-MM-DD|SESSION"
  const usedGvByDateSession: Record<string, string[]> = {};
  for (const c of allCommittees) {
    if (c.id === id) continue; // bỏ qua HĐ hiện tại
    const date = c.defense_date?.split("T")[0] ?? "";
    if (!date) continue;
    const session = c.defense_session ?? "";
    const key = `${date}|${session}`;
    if (!usedGvByDateSession[key]) usedGvByDateSession[key] = [];
    [c.chair_id, c.secretary_id, c.member_1_id, c.member_2_id, c.member_3_id, c.member_4_id, c.member_5_id]
      .filter(Boolean).forEach((gvId) => usedGvByDateSession[key].push(gvId));
  }

  const displayDate = committee.defense_date
    ? new Date(committee.defense_date + (committee.defense_date.includes("T") ? "" : "T00:00:00")).toLocaleDateString("vi-VN", {
        weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "Chưa xác định";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Link href="/dean/committees" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách hội đồng
          </Link>
          <DeleteCommitteeButton
            committeeId={id}
            committeeName={committee.committee_name ?? ""}
            topicCount={assignedTopics.length}
          />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{committee.committee_name}</h1>
        <div className="flex flex-wrap gap-3 mt-2">
          <span className="flex items-center gap-1 text-sm text-slate-500">
            <Calendar className="w-3.5 h-3.5" /> {displayDate}
          </span>
          {committee.defense_session && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              committee.defense_session === "MORNING"
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-indigo-50 border-indigo-200 text-indigo-700"
            }`}>
              {committee.defense_session === "MORNING" ? "Buổi sáng" : "Buổi chiều"}
            </span>
          )}
          {committee.defense_location && (
            <span className="flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="w-3.5 h-3.5" /> {committee.defense_location}
            </span>
          )}
        </div>
      </div>

      {/* Thành viên hội đồng */}
      <Card title="Thành viên hội đồng" action={
        <EditCommitteeForm
          committeeId={id}
          initial={{
            committee_name: committee.committee_name ?? "",
            defense_date: committee.defense_date?.split("T")[0] ?? "",
            defense_session: committee.defense_session ?? "MORNING",
            defense_location: committee.defense_location ?? "",
            chair_id: committee.chair_id ?? "",
            secretary_id: committee.secretary_id ?? "",
            member_1_id: committee.member_1_id ?? "",
            member_2_id: committee.member_2_id ?? "",
            member_3_id: committee.member_3_id ?? "",
            member_4_id: committee.member_4_id ?? "",
            member_5_id: committee.member_5_id ?? "",
          }}
          lecturers={lecturerOptions}
          secretaryLecturers={secretaryLecturerOptions}
          usedGvByDateSession={usedGvByDateSession}
        />
      }>
        <div className="flex flex-wrap gap-2">
          {committee.chair_id && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-blue-600">Chủ tịch</span>
              <span className="text-sm text-blue-800">{userMap.get(committee.chair_id)?.full_name ?? "—"}</span>
            </div>
          )}
          {committee.secretary_id && (
            <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-purple-600">Thư ký</span>
              <span className="text-sm text-purple-800">{userMap.get(committee.secretary_id)?.full_name ?? "—"}</span>
            </div>
          )}
          {[committee.member_1_id, committee.member_2_id, committee.member_3_id, committee.member_4_id, committee.member_5_id]
            .filter(Boolean)
            .map((memberId, i) => (
              <div key={memberId} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-xs font-semibold text-slate-500">TV{i + 1}</span>
                <span className="text-sm text-slate-700">{userMap.get(memberId!)?.full_name ?? "—"}</span>
              </div>
            ))}
        </div>
      </Card>

      {/* Sinh viên & đề tài */}
      <CommitteeTopicsSection
        key={memberIds.join(",")}
        committeeId={id}
        assignedTopics={assignedTopics}
        pendingTopics={pendingTopics}
      />
    </div>
  );
}
