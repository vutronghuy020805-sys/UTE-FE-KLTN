export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isTBMUser } from "@/lib/permissions";
import { db } from "@/lib/sheets/client";
import { Bell } from "lucide-react";
import { RemindersTable } from "./reminders-table";
import { AutoReminderCards } from "./auto-reminder-cards";

export default async function DeanRemindersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!isTBMUser(session.user)) redirect("/");

  const [all, activeTerm, allTopics, allScores] = await Promise.all([
    db.reminders.getAll() as Promise<Record<string, string>[]>,
    db.terms.getActive(),
    db.topics.getAll() as Promise<Record<string, string>[]>,
    db.scores.getAll() as Promise<Record<string, string>[]>,
  ]);
  all.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const INACTIVE = ["HOAN_TAT", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN", "GVHD_TU_CHOI"];
  const activeTopics = allTopics.filter((t) => !INACTIVE.includes(t.current_status));

  // GVHD chưa chấm điểm HD
  const gradedSupTopicIds = new Set(
    allScores.filter((s) => s.score_role === "SUPERVISOR").map((s) => s.topic_id),
  );
  const ungradedSupervisorCount = new Set(
    activeTopics
      .filter((t) => t.supervisor_id && !gradedSupTopicIds.has(t.id))
      .map((t) => t.supervisor_id),
  ).size;

  // GVPB chưa chấm điểm PB
  const gradedRevTopicIds = new Set(
    allScores.filter((s) => s.score_role === "REVIEWER").map((s) => s.topic_id),
  );
  const ungradedReviewerCount = new Set(
    activeTopics
      .filter((t) => t.reviewer_id && !gradedRevTopicIds.has(t.id))
      .map((t) => t.reviewer_id),
  ).size;

  // SV đăng ký BCTT
  const bcttStudentCount = allTopics.filter((t) => t.topic_type === "BCTT" && t.student_id).length;

  // GVHD chưa duyệt chỉnh sửa sau bảo vệ (status CHO_GVHD_XAC_NHAN)
  const pendingRevisionTopics = allTopics.filter(
    (t) =>
      t.current_status === "CHO_GVHD_XAC_NHAN" &&
      t.topic_type !== "BCTT" &&
      t.supervisor_id,
  );
  const pendingRevisionGVHDCount = new Set(pendingRevisionTopics.map((t) => t.supervisor_id)).size;

  // CT HĐ chưa phê duyệt cuối cùng (status CHO_CHU_TICH_DUYET)
  const [allCommitteeTopics, allCommittees] = await Promise.all([
    db.committeeTopics.getAll() as Promise<Record<string, string>[]>,
    db.committees.getAll() as Promise<Record<string, string>[]>,
  ]);
  const committeeMap = new Map(allCommittees.map((c) => [c.id, c]));
  const pendingChairTopics = allTopics.filter(
    (t) => t.current_status === "CHO_CHU_TICH_DUYET" && t.topic_type !== "BCTT",
  );
  const pendingChairIds = new Set<string>();
  for (const t of pendingChairTopics) {
    const assignment = allCommitteeTopics.find((a) => a.topic_id === t.id);
    const chair = assignment ? committeeMap.get(assignment.committee_id)?.chair_id : undefined;
    if (chair) pendingChairIds.add(chair);
  }
  const pendingChairCount = pendingChairIds.size;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = all.filter((r) => {
    if (!r.deadline_date) return false;
    const d = new Date(r.deadline_date);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });

  const rows = all.map((r) => ({
    id: r.id ?? "",
    title: r.title ?? "",
    content: r.content ?? "",
    deadline_date: r.deadline_date ?? "",
    reminder_dates: r.reminder_dates ?? "",
    email_list: r.email_list ?? "",
    sent_dates: r.sent_dates ?? "",
  }));

  // Lấy danh sách giảng viên để chọn nhanh trong form
  const allUsers = (await db.users.getAll()) as Record<string, string>[];
  const lecturers = allUsers
    .filter((u) => ["LECTURER", "DEAN"].includes(u.system_role) && u.email)
    .map((u) => ({ id: u.id, name: u.full_name ?? u.email, email: u.email }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-900">Quản lý nhắc hạn</h1>
        </div>
        <p className="text-sm text-slate-500">
          Tạo nhắc hạn tự động — hệ thống chỉ gửi email cho đúng đối tượng cần nhắc.
        </p>
      </div>

      {/* Stat cards */}
      {all.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-700">{all.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Tổng nhắc hạn</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{upcoming.length}</p>
            <p className="text-xs text-amber-600 mt-0.5">Sắp tới</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{all.length - upcoming.length}</p>
            <p className="text-xs text-blue-600 mt-0.5">Đã qua hạn</p>
          </div>
        </div>
      )}

      {/* Auto reminder cards */}
      <AutoReminderCards
        kltnDeadline={activeTerm?.kltn_deadline ?? null}
        bcttDeadline={activeTerm?.bctt_deadline ?? null}
        ungradedSupervisorCount={ungradedSupervisorCount}
        ungradedReviewerCount={ungradedReviewerCount}
        bcttStudentCount={bcttStudentCount}
        pendingRevisionGVHDCount={pendingRevisionGVHDCount}
        pendingChairCount={pendingChairCount}
      />

      {/* Table */}
      <RemindersTable rows={rows} lecturers={lecturers} />
    </div>
  );
}
