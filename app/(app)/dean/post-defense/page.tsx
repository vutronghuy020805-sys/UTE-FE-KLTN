export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { calculateTotalScore } from "@/lib/constants";
import { filterTopicsByDeanMajor } from "@/lib/permissions";
import { PostDefenseTable, type PostDefenseRow } from "./post-defense-table";

export default async function PostDefensePage() {
  const [allTopicsAll, allUsers, allCommittees, allCommitteeTopics, allScores, allFiles] =
    await Promise.all([
      db.topics.getAll(),
      db.users.getAll(),
      db.committees.getAll(),
      db.committeeTopics.getAll(),
      db.scores.getAll(),
      db.files.getAll(),
    ]);

  const allTopics = await filterTopicsByDeanMajor(allTopicsAll);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const scoresByTopic = new Map<string, typeof allScores>();
  for (const s of allScores) {
    if (!scoresByTopic.has(s.topic_id)) scoresByTopic.set(s.topic_id, []);
    scoresByTopic.get(s.topic_id)!.push(s);
  }

  const filesByTopic = new Map<string, typeof allFiles>();
  for (const f of allFiles) {
    if (!filesByTopic.has(f.topic_id)) filesByTopic.set(f.topic_id, []);
    filesByTopic.get(f.topic_id)!.push(f);
  }

  // Đề tài đã đến giai đoạn chỉnh sửa sau bảo vệ
  const revisionStatuses = ["CAN_CHINH_SUA", "CHO_GVHD_XAC_NHAN", "CHO_CHU_TICH_DUYET", "HOAN_TAT"];
  // Trạng thái duyệt: "approved" = đã xong, "pending" = đến lượt mà chưa làm, "waiting" = chưa đến lượt
  const getGvhdState = (status: string): "approved" | "pending" | "waiting" => {
    if (status === "CHO_CHU_TICH_DUYET" || status === "HOAN_TAT") return "approved";
    if (status === "CHO_GVHD_XAC_NHAN") return "pending";
    return "waiting"; // CAN_CHINH_SUA — chờ SV nộp file chỉnh sửa
  };
  const getChairState = (status: string): "approved" | "pending" | "waiting" => {
    if (status === "HOAN_TAT") return "approved";
    if (status === "CHO_CHU_TICH_DUYET") return "pending";
    return "waiting"; // CAN_CHINH_SUA hoặc CHO_GVHD_XAC_NHAN — chờ giai đoạn trước
  };
  const rows: PostDefenseRow[] = allTopics
    .filter((t) => t.topic_type === "KLTN" && revisionStatuses.includes(t.current_status))
    .map((t) => {
      const gvhdState = getGvhdState(t.current_status);
      const chairState = getChairState(t.current_status);
      const assignment = allCommitteeTopics.find((a) => a.topic_id === t.id);
      const committee = assignment ? allCommittees.find((c) => c.id === assignment.committee_id) : null;
      const chairUser = committee?.chair_id ? userMap.get(committee.chair_id) ?? null : null;
      const student = userMap.get(t.student_id) ?? null;
      const supervisor = t.supervisor_id ? userMap.get(t.supervisor_id) ?? null : null;

      const scores = scoresByTopic.get(t.id) ?? [];
      const sv = scores.find((s) => s.score_role === "SUPERVISOR");
      const pb = scores.find((s) => s.score_role === "REVIEWER");
      const hd = scores.filter((s) => s.score_role === "COMMITTEE_MEMBER");
      const total = calculateTotalScore(
        sv ? Number(sv.score_value) : undefined,
        pb ? Number(pb.score_value) : undefined,
        hd.map((s) => Number(s.score_value)),
      );

      const topicFiles = filesByTopic.get(t.id) ?? [];
      const chinhSua = topicFiles
        .filter((f) => f.file_type === "CHINH_SUA")
        .sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))[0] ?? null;
      const giaiTrinh = topicFiles
        .filter((f) => f.file_type === "PHIEU_GIAI_TRINH")
        .sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))[0] ?? null;

      return {
        topicId: t.id,
        studentName: student?.full_name ?? "—",
        studentCode: student?.student_code ?? "—",
        academicYear: t.academic_year,
        semester: t.semester,
        batch: t.batch,
        total,
        supervisorName: supervisor?.full_name ?? "—",
        chairName: chairUser?.full_name ?? "—",
        gvhdState,
        chairState,
        chinhSuaUrl: chinhSua?.file_url ?? null,
        chinhSuaName: chinhSua?.original_name ?? null,
        chinhSuaUploadedAt: chinhSua?.uploaded_at ?? null,
        giaiTrinhUrl: giaiTrinh?.file_url ?? null,
        giaiTrinhName: giaiTrinh?.original_name ?? null,
        giaiTrinhUploadedAt: giaiTrinh?.uploaded_at ?? null,
      } satisfies PostDefenseRow;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Theo dõi sau bảo vệ</h1>
        <p className="text-sm text-slate-500 mt-1">
          Trạng thái nộp bài chỉnh sửa, biên bản giải trình và phê duyệt từ GVHD/CTHĐ.
        </p>
      </div>
      <PostDefenseTable rows={rows} />
    </div>
  );
}
