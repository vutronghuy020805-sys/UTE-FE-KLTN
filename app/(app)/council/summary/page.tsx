export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { calculateTotalScore, PASSING_SCORE } from "@/lib/constants";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { SummaryFilterTable } from "./summary-filter-table";
import { CommitteeActions } from "./committee-actions";

export default async function SecretarySummaryListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  // Chỉ lấy các hội đồng mà user là THƯ KÝ
  const allCommittees = await db.committees.getAllWithTopics();
  const mySecretaryCommittees = allCommittees.filter(
    (c) => c.secretary_id === userId,
  );

  const topicsData = await Promise.all(
    mySecretaryCommittees.map(async (committee) => {
      const topic = await db.topics.findById(committee.topic_id);
      if (!topic) return null;

      const [student, scores] = await Promise.all([
        db.users.findById(topic.student_id),
        db.scores.filter({ topic_id: committee.topic_id }),
      ]);

      const svScore = scores.find((s) => s.score_role === "SUPERVISOR");
      const pbScore = scores.find((s) => s.score_role === "REVIEWER");
      const committeeScores = scores.filter(
        (s) => s.score_role === "COMMITTEE_MEMBER",
      );

      const bothPassed = svScore && pbScore;

      const totalScore = calculateTotalScore(
        svScore ? Number(svScore.score_value) : undefined,
        pbScore ? Number(pbScore.score_value) : undefined,
        committeeScores.map((s) => Number(s.score_value)),
      );

      const committeeScoreCount = committeeScores.length;
      const committeeAvg = committeeScoreCount > 0
        ? committeeScores.reduce((a, s) => a + Number(s.score_value), 0) / committeeScoreCount
        : null;
      // Đếm số thành viên HĐ được chấm điểm (chủ tịch + thành viên, không kể thư ký)
      const memberCount = [
        committee.chair_id,
        committee.member_1_id,
        committee.member_2_id,
        committee.member_3_id,
        committee.member_4_id,
        committee.member_5_id,
      ].filter(Boolean).length;

      return {
        topic,
        committee,
        student,
        bothPassed,
        totalScore,
        committeeScoreCount,
        committeeAvg,
        memberCount,
        svScore: svScore ? Number(svScore.score_value) : null,
        pbScore: pbScore ? Number(pbScore.score_value) : null,
      };
    }),
  );

  const valid = topicsData.filter(Boolean) as NonNullable<
    (typeof topicsData)[0]
  >[];

  const ready = valid.filter((d) => d.bothPassed);
  const waiting = valid.filter((d) => !d.bothPassed);
  const finalized = ready.filter((d) => d.topic.current_status === "HOAN_TAT");
  const inProgress = ready.filter((d) => d.topic.current_status !== "HOAN_TAT");

  const summaryRows = valid.map((d) => {
    // Nếu GVPB chấm < 5 nhưng status trong DB vẫn đang là DA_CHAM_PHAN_BIEN
    // (dữ liệu cũ trước khi sửa logic GVPB), override hiển thị về KHONG_DAT_PHAN_BIEN
    const rawStatus = d.topic.current_status;
    const pbFailed = d.pbScore !== null && d.pbScore < PASSING_SCORE;
    const effectiveStatus =
      pbFailed && rawStatus === "DA_CHAM_PHAN_BIEN" ? "KHONG_DAT_PHAN_BIEN" : rawStatus;
    return {
      topicId: d.topic.id,
      title: d.topic.title,
      committeeName: d.committee.committee_name ?? "",
      orderIndex: parseInt(d.committee.order_index ?? "", 10) || null,
      studentName: d.student?.full_name ?? "—",
      studentCode: d.student?.student_code ?? "",
      bothPassed: !!(d.bothPassed),
      svScore: d.svScore,
      pbScore: d.pbScore,
      committeeAvg: d.committeeAvg,
      totalScore: d.totalScore,
      committeeScoreCount: d.committeeScoreCount,
      memberCount: d.memberCount,
      currentStatus: effectiveStatus,
    };
  });

  // Gom các đề tài theo hội đồng để hiển thị nút Excel + Xác nhận gửi BBHD ở trên
  const committeeGroups = new Map<
    string,
    { committeeId: string; committeeName: string; sampleTopicId: string; count: number }
  >();
  for (const d of valid) {
    const cid = d.committee.id;
    const existing = committeeGroups.get(cid);
    if (existing) {
      existing.count++;
    } else {
      committeeGroups.set(cid, {
        committeeId: cid,
        committeeName: d.committee.committee_name ?? "",
        sampleTopicId: d.topic.id,
        count: 1,
      });
    }
  }
  const committeeList = Array.from(committeeGroups.values());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ScrollText className="w-5 h-5 text-purple-600" />
          <h1 className="text-xl font-bold text-slate-900">
            Tổng hợp điểm — Thư ký hội đồng
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Danh sách các đề tài bạn là Thư ký hội đồng, có thể xem điểm tổng hợp
          và xác nhận hoàn tất.
        </p>
      </div>

      {/* Thống kê nhanh */}
      {valid.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Tổng hồ sơ"
            value={valid.length}
            color="slate"
          />
          <StatCard
            label="Sẵn sàng chấm"
            value={inProgress.length}
            color="amber"
          />
          <StatCard
            label="Chờ GVHD/GVPB"
            value={waiting.length}
            color="blue"
          />
          <StatCard
            label="Đã hoàn tất"
            value={finalized.length}
            color="green"
          />
        </div>
      )}

      {/* Nút Excel điểm + Xác nhận gửi BBHD theo từng hội đồng */}
      {committeeList.length > 0 && (
        <div className="space-y-2">
          {committeeList.map((c) => (
            <CommitteeActions
              key={c.committeeId}
              committeeId={c.committeeId}
              committeeName={c.committeeName}
              sampleTopicId={c.sampleTopicId}
              totalTopics={c.count}
            />
          ))}
        </div>
      )}

      <SummaryFilterTable rows={summaryRows} />
    </div>
  );
}


function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "amber" | "blue" | "green";
}) {
  const colors = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };
  return (
    <div
      className={`rounded-xl border p-4 text-center ${colors[color]}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
