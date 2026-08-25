export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { PendingApprovalTable } from "./pending-approval-table";
import { StudentsFilterTable } from "./students-filter-table";
import { BcttSeenAllButton } from "./bctt-seen-button";
import { redirect } from "next/navigation";
import { Clock, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function SupervisorStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const allTopics = await db.topics.filter({ supervisor_id: userId });

  type TopicWithStudent = Record<string, string> & {
    student: Record<string, string> | null;
  };
  const topicsWithStudents: TopicWithStudent[] = await Promise.all(
    allTopics.map(async (t) => {
      const student = await db.users.findById(t.student_id);
      return { ...t, student } as TopicWithStudent;
    }),
  );

  // KLTN chờ duyệt (BCTT không còn cần duyệt nữa)
  const pending = topicsWithStudents.filter(
    (t) => t.current_status === "CHO_GVHD_DUYET" && t.topic_type !== "BCTT",
  );
  // BCTT — tất cả đề tài BCTT của GV
  const bcttTopics = topicsWithStudents.filter((t) => t.topic_type === "BCTT");
  const active = topicsWithStudents.filter(
    (t) => !["GVHD_TU_CHOI", "CHO_GVHD_DUYET"].includes(t.current_status),
  );

  // Fetch files, scores và audit logs song song
  const activeTopicIds = new Set(active.map((t) => t.id));
  const [allFiles, allScores, allAuditLogs] = await Promise.all([
    db.files.getAll(),
    db.scores.getAll(),
    db.auditLogs.getAll(),
  ]);

  // Xác định BCTT đã xem từ audit_logs (bền vững qua reload)
  const seenBcttIds = new Set(
    (allAuditLogs as Array<Record<string, string>>)
      .filter((l) => l.action === "BCTT_SEEN" && l.user_id === userId)
      .map((l) => l.entity_id),
  );
  const allBcttSeen = bcttTopics.length > 0 && bcttTopics.every((t) => seenBcttIds.has(t.id));
  const unseenBcttIds = bcttTopics.filter((t) => !seenBcttIds.has(t.id)).map((t) => t.id);

  const filesByTopic = new Map<string, typeof allFiles>();
  for (const f of allFiles) {
    if (!activeTopicIds.has(f.topic_id)) continue;
    if (!filesByTopic.has(f.topic_id)) filesByTopic.set(f.topic_id, []);
    filesByTopic.get(f.topic_id)!.push(f);
  }

  const scoresByTopic = new Map<string, typeof allScores>();
  for (const s of allScores) {
    if (!activeTopicIds.has(s.topic_id)) continue;
    if (!scoresByTopic.has(s.topic_id)) scoresByTopic.set(s.topic_id, []);
    scoresByTopic.get(s.topic_id)!.push(s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Danh sách sinh viên hướng dẫn</h1>
      </div>

      {/* KLTN chờ duyệt */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-amber-700">Chờ xác nhận hướng dẫn (KLTN)</h2>
          </div>
          <PendingApprovalTable topics={pending as any} />
        </div>
      )}

      {/* BCTT */}
      {bcttTopics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-blue-700">
              BCTT ({bcttTopics.length})
            </h2>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sinh viên</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Đề tài</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Đăng ký</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bcttTopics.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{t.student?.full_name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{t.student?.student_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 max-w-xs truncate">{t.title}</p>
                      <p className="text-xs text-slate-400">{t.student?.department}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <BcttSeenAllButton unseenTopicIds={unseenBcttIds} initialAllSeen={allBcttSeen} />
          </div>
        </div>
      )}

      {/* Đang thực hiện */}
      <div className="space-y-2">
        {active.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-400">Chưa có sinh viên đang hướng dẫn</p>
            </div>
          </Card>
        ) : (
          <StudentsFilterTable
            topics={active.map((t) => {
              const files = filesByTopic.get(t.id) ?? [];
              const scores = scoresByTopic.get(t.id) ?? [];
              const baiLamFile = files.find((f) =>
                ["KHOA_LUAN", "BAO_CAO"].includes(f.file_type),
              );
              const turnitinFile = files.find((f) => f.file_type === "TURNITIN");
              const baiBaoFile = files.find((f) => f.file_type === "BAI_BAO");
              const supScore = scores.find(
                (s) => s.score_role === "SUPERVISOR" && s.scorer_id === userId,
              );
              return {
                id: t.id,
                title: t.title,
                topic_type: t.topic_type,
                current_status: t.current_status,
                student: t.student
                  ? {
                      full_name: t.student.full_name,
                      email: t.student.email ?? "",
                      student_code: t.student.student_code ?? "",
                      department: t.student.department ?? "",
                      major: t.student.major ?? "",
                    }
                  : null,
                baiLamUrl: baiLamFile?.file_url ?? null,
                turnitinUrl: turnitinFile?.file_url ?? null,
                baiBaoUrl: baiBaoFile?.file_url ?? null,
                supervisorScore:
                  supScore ? Number(supScore.score_value) : undefined,
                supervisorComment: supScore?.comment ?? undefined,
              };
            })}
          />
        )}
      </div>
    </div>
  );
}
