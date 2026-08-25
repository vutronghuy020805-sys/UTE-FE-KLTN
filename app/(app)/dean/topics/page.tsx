export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { TopicsFilterTable } from "./topics-filter-table";
import { autoPassUngradedGVHD } from "@/app/actions/topic.actions";
import { filterTopicsByDeanMajor } from "@/lib/permissions";

export default async function DeanTopicsPage() {
  // Auto-pass GVHD: luôn chạy tự động khi có đề tài KLTN chưa chấm.
  // Fail silent để không block page.
  try {
    await autoPassUngradedGVHD();
  } catch {
    /* silent */
  }

  const [allTopicsRawAll, allUsers, allScores, allCommittees, allCommitteeTopics] = await Promise.all([
    db.topics.getAll(),
    db.users.getAll(),
    db.scores.getAll().catch(() => [] as Record<string, string>[]),
    db.committees.getAll().catch(() => [] as Record<string, string>[]),
    db.committeeTopics.getAll().catch(() => [] as Record<string, string>[]),
  ]);

  // Lọc theo ngành của TBM (ADMIN thấy tất cả)
  const allTopicsRaw = await filterTopicsByDeanMajor(allTopicsRawAll);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const committeeMap = new Map(allCommittees.map((c) => [c.id, c]));

  // topic_id → committee
  const topicToCommittee = new Map<string, Record<string, string>>();
  for (const a of allCommitteeTopics) {
    const c = committeeMap.get(a.committee_id);
    if (c) topicToCommittee.set(a.topic_id, c);
  }

  // Đề tài có điểm GVHD < 5 (không đạt) — TBM không nên xếp hội đồng
  const gvhdFailedTopicIds = new Set(
    allScores
      .filter((s) => {
        if (s.score_role !== "SUPERVISOR") return false;
        const v = Number(s.score_value);
        return Number.isFinite(v) && v < 5;
      })
      .map((s) => s.topic_id),
  );

  const topics = allTopicsRaw.map((t) => {
    const c = topicToCommittee.get(t.id) ?? null;
    return {
      id: t.id,
      title: t.title,
      field: t.field ?? "",
      topic_type: t.topic_type,
      current_status: t.current_status,
      created_at: t.created_at,
      student: t.student_id ? (userMap.get(t.student_id) ?? null) : null,
      supervisor: t.supervisor_id ? (userMap.get(t.supervisor_id) ?? null) : null,
      reviewer: t.reviewer_id ? (userMap.get(t.reviewer_id) ?? null) : null,
      gvhdFailed: gvhdFailedTopicIds.has(t.id),
      committee: c ? { id: c.id, name: c.committee_name ?? "", defense_date: c.defense_date ?? "", defense_session: c.defense_session ?? "", defense_location: c.defense_location ?? "" } : null,
    };
  });

  const supervisorMap = new Map<string, { id: string; full_name: string }>();
  for (const t of topics) {
    if (t.supervisor) supervisorMap.set(t.supervisor.id, t.supervisor);
  }
  const supervisors = [...supervisorMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "vi"),
  );

  return (
    <div>
      <TopicsFilterTable topics={topics} supervisors={supervisors} />
    </div>
  );
}
