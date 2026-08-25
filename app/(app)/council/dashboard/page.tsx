export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Pencil, Calendar, MapPin } from "lucide-react";
import { PASSING_SCORE } from "@/lib/constants";

export default async function CouncilDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const allCommittees = await db.committees.getAllWithTopics();
  const myCommittees = allCommittees.filter(
    (c) =>
      c.secretary_id === userId ||
      c.chair_id === userId ||
      c.member_1_id === userId ||
      c.member_2_id === userId ||
      c.member_3_id === userId ||
      c.member_4_id === userId ||
      c.member_5_id === userId,
  );

  const topicsData = await Promise.all(
    myCommittees.map(async (committee) => {
      const topic = await db.topics.findById(committee.topic_id);
      if (!topic) return null;

      const scores = await db.scores.filter({ topic_id: committee.topic_id });
      const svScore = scores.find((s) => s.score_role === "SUPERVISOR");
      const pbScore = scores.find((s) => s.score_role === "REVIEWER");
      const bothPassed = svScore && pbScore;

      const [student, supervisor] = await Promise.all([
        db.users.findById(topic.student_id),
        topic.supervisor_id ? db.users.findById(topic.supervisor_id) : Promise.resolve(null),
      ]);
      const isSecretary = committee.secretary_id === userId;
      const myScore = scores.find(
        (s) => s.scorer_id === userId && s.score_role === "COMMITTEE_MEMBER",
      );

      return { topic, committee, bothPassed, student, supervisor, isSecretary, myScore };
    }),
  );

  const valid = topicsData.filter(Boolean) as NonNullable<
    (typeof topicsData)[0]
  >[];
  const accessible = valid.filter((d) => d.bothPassed);
  const locked = valid.filter((d) => !d.bothPassed);

  // Tóm tắt HĐ user tham gia (de-dup theo committee.id) — hiển thị bên cạnh tiêu đề
  type MyCommitteeInfo = {
    id: string;
    name: string;
    date: string;
    session: string;
    location: string;
    role: string;
  };
  function roleOf(c: typeof myCommittees[0]): string {
    if (c.chair_id === userId) return "Chủ tịch";
    if (c.secretary_id === userId) return "Thư ký";
    return "Thành viên";
  }
  const summaryMap = new Map<string, MyCommitteeInfo>();
  for (const c of myCommittees) {
    if (!c.id || summaryMap.has(c.id)) continue;
    summaryMap.set(c.id, {
      id: c.id,
      name: c.committee_name ?? "Hội đồng",
      date: c.defense_date?.split("T")[0] ?? "",
      session: c.defense_session ?? "",
      location: c.defense_location ?? "",
      role: roleOf(c),
    });
  }
  const mySummaries = [...summaryMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  function fmtDate(s: string): string {
    if (!s) return "Chưa cập nhật";
    const d = new Date(s + (s.includes("T") ? "" : "T00:00:00"));
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  function fmtSession(s: string): string {
    if (s === "MORNING") return "Sáng (7h30)";
    if (s === "AFTERNOON") return "Chiều (13h30)";
    return "";
  }
  function roleBadgeClass(r: string): string {
    if (r === "Chủ tịch") return "bg-amber-50 text-amber-700 border-amber-200";
    if (r === "Thư ký") return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 whitespace-nowrap">Dashboard Hội đồng</h1>
          {mySummaries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mySummaries.map((s) => {
                const sessionLabel = fmtSession(s.session);
                return (
                  <div
                    key={s.id}
                    className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs text-slate-600"
                  >
                    <span className="font-semibold text-slate-700" title={s.name}>{s.name}</span>
                    <span className="text-slate-300">—</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      {fmtDate(s.date)}
                      {sessionLabel && <span className="text-slate-400"> · {sessionLabel}</span>}
                    </span>
                    <span className="text-slate-300">—</span>
                    <span className="inline-flex items-center gap-1" title={s.location}>
                      <MapPin className="w-3.5 h-3.5 text-red-400" />
                      {s.location || "Chưa cập nhật phòng"}
                    </span>
                    <span className="text-slate-300">—</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleBadgeClass(s.role)}`}
                    >
                      {s.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Hồ sơ chỉ hiển thị khi cả GVHD và GVPB đã chấm điểm đạt
        </p>
      </div>

      <Card title={`Hồ sơ hội đồng (${accessible.length})`}>
        {accessible.length === 0 ? (
          /* FIX: bỏ EmptyState với icon prop, dùng div inline */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Chưa có hồ sơ nào sẵn sàng
            </h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Hồ sơ sẽ xuất hiện sau khi GVHD và GVPB đều đã chấm điểm đạt
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
          <Table>
            <Thead>
              <tr>
                <Th>Sinh viên</Th>
                <Th>Đề tài</Th>
                <Th>GVHD</Th>
                <Th className="text-right">Điểm HĐ</Th>
              </tr>
            </Thead>
            <Tbody>
              {accessible.map((d) => {
                const score = d.myScore ? Number(d.myScore.score_value) : null;
                const href = d.isSecretary
                  ? `/council/summary/${d.topic.id}`
                  : `/council/topics/${d.topic.id}`;
                const title = d.isSecretary
                  ? "Xem tổng hợp"
                  : score !== null
                    ? "Cập nhật điểm"
                    : "Nhập điểm";
                return (
                  <Tr key={d.topic.id}>
                    <Td className="whitespace-nowrap">
                      <p className="font-medium text-slate-800">
                        {d.student?.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {d.student?.student_code}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-sm text-slate-700 leading-snug">
                        {d.topic.title}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <p className="text-sm text-slate-700">
                        {d.supervisor?.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {d.supervisor?.email ?? ""}
                      </p>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={href}
                        title={title}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        {score !== null ? (
                          <span className={`text-sm font-bold ${score >= PASSING_SCORE ? "text-green-600" : "text-red-600"}`}>
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          </div>
        )}
      </Card>

      {locked.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-500">
          <Lock className="w-4 h-4 text-slate-400" />
          <span>
            Còn <strong>{locked.length}</strong> hồ sơ đang chờ GVHD/GVPB chấm
            điểm đạt
          </span>
        </div>
      )}
    </div>
  );
}
