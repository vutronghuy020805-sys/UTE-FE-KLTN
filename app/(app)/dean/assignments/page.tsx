export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { AssignBulkSection } from "./assign-bulk-section";
import { AssignedTopicsFilterTable } from "./assigned-topics-filter-table";
import { filterTopicsByDeanMajor } from "@/lib/permissions";

export default async function DeanAssignmentsPage() {
  const [allTopicsAll, allUsers, allScores] = await Promise.all([
    db.topics.getAll(),
    db.users.getAll(),
    db.scores.getAll().catch(() => [] as Record<string, string>[]),
  ]);

  // Lọc theo ngành của TBM (ADMIN thấy tất cả)
  const allTopics = await filterTopicsByDeanMajor(allTopicsAll);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const allLecturers = allUsers.filter((u) => ["LECTURER", "DEAN"].includes(u.system_role));

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

  const eligibleStatuses = ["DANG_THUC_HIEN", "CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN"];
  const readyTopics = allTopics
    .filter((t) => eligibleStatuses.includes(t.current_status) && !t.reviewer_id && t.topic_type === "KLTN")
    .map((t) => ({
      ...t,
      student: userMap.get(t.student_id) ?? null,
      supervisor: t.supervisor_id ? userMap.get(t.supervisor_id) ?? null : null,
    }))
    .sort((a, b) => `${a.academic_year}${a.semester}${a.batch}`.localeCompare(`${b.academic_year}${b.semester}${b.batch}`));

  const assignedTopics = allTopics
    .filter((t) => t.reviewer_id && ["DANG_THUC_HIEN", "CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN", "CHO_CHAM_PHAN_BIEN", "DA_CHAM_PHAN_BIEN"].includes(t.current_status))
    .map((t) => ({
      ...t,
      student: userMap.get(t.student_id) ?? null,
      supervisor: t.supervisor_id ? userMap.get(t.supervisor_id) ?? null : null,
      reviewer: t.reviewer_id ? userMap.get(t.reviewer_id) ?? null : null,
    }));

  const lecturerOptions = allLecturers.map((l) => ({ value: l.id, label: l.full_name }));

  // Unique reviewers for the filter dropdown
  const reviewerMap = new Map<string, { id: string; full_name: string }>();
  for (const t of assignedTopics) {
    if (t.reviewer) reviewerMap.set(t.reviewer.id, { id: t.reviewer.id, full_name: t.reviewer.full_name });
  }
  const reviewers = [...reviewerMap.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "vi"),
  );

  return (
    <div className="space-y-4">
      {/* Chờ phân công */}
      {readyTopics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-600">Chờ phân công GVPB</h2>
            <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {readyTopics.length} đề tài
            </span>
          </div>
          <Card>
            <AssignBulkSection
          topics={readyTopics.map((t) => ({
            id: t.id,
            title: t.title,
            current_status: t.current_status,
            supervisor_id: t.supervisor_id ?? "",
            academic_year: t.academic_year ?? "",
            semester: t.semester ?? "",
            batch: t.batch ?? "",
            student: t.student ? { full_name: t.student.full_name, student_code: t.student.student_code ?? "", department: t.student.department ?? "" } : null,
            supervisor: t.supervisor ? { full_name: t.supervisor.full_name } : null,
            gvhdFailed: gvhdFailedTopicIds.has(t.id),
          }))}
          lecturers={lecturerOptions}
        />
          </Card>
        </div>
      )}

      {/* Đã phân công */}
      {assignedTopics.length > 0 && (
        <div>
          <AssignedTopicsFilterTable
            topics={assignedTopics.map((t) => ({
              id: t.id,
              title: t.title,
              current_status: t.current_status,
              topic_type: t.topic_type,
              academic_year: t.academic_year,
              semester: t.semester,
              batch: t.batch,
              supervisor_id: t.supervisor_id ?? "",
              student: t.student ? { full_name: t.student.full_name, student_code: t.student.student_code ?? "" } : null,
              supervisor: t.supervisor ? { full_name: t.supervisor.full_name } : null,
              reviewer: t.reviewer ? { id: t.reviewer.id, full_name: t.reviewer.full_name } : null,
              gvhdFailed: gvhdFailedTopicIds.has(t.id),
            }))}
            reviewers={reviewers}
            lecturers={lecturerOptions}
          />
        </div>
      )}
    </div>
  );
}
