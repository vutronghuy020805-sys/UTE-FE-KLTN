export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { redirect } from "next/navigation";
import { Crown, CheckCircle2, Clock, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { ChairBulkApproveButton, ChairBulkFinalizeButton, ChairFinalizeInlineButton } from "./chair-bulk-approve-button";

export default async function CouncilChairPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const allCommittees = await db.committees.getAllWithTopics();
  const myChairCommittees = allCommittees.filter((c) => c.chair_id === userId);

  const data = await Promise.all(
    myChairCommittees.map(async (committee) => {
      const topic = await db.topics.findById(committee.topic_id);
      if (!topic) return null;
      const [student, supervisor, reviewer] = await Promise.all([
        db.users.findById(topic.student_id),
        topic.supervisor_id ? db.users.findById(topic.supervisor_id) : Promise.resolve(null),
        topic.reviewer_id ? db.users.findById(topic.reviewer_id) : Promise.resolve(null),
      ]);
      return { committee, topic, student, supervisor, reviewer };
    }),
  );

  const valid = data.filter(Boolean) as NonNullable<(typeof data)[0]>[];
  const pending = valid.filter((d) => d.topic.current_status === "CHO_CHU_TICH_DUYET");
  const pendingFinalize = valid.filter((d) => d.topic.current_status === "CHO_THU_KY_XAC_NHAN");

  // De-dup committees để hiện chip kế bên tiêu đề (1 chip / 1 HĐ)
  type ChairCommitteeInfo = {
    id: string;
    name: string;
    date: string;
    session: string;
    location: string;
  };
  const summaryMap = new Map<string, ChairCommitteeInfo>();
  for (const c of myChairCommittees) {
    if (!c.id || summaryMap.has(c.id)) continue;
    summaryMap.set(c.id, {
      id: c.id,
      name: c.committee_name ?? "Hội đồng",
      date: c.defense_date?.split("T")[0] ?? "",
      session: c.defense_session ?? "",
      location: c.defense_location ?? "",
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

  const bulkAction = (
    <div className="flex items-center gap-2">
      {pendingFinalize.length > 0 && (
        <ChairBulkFinalizeButton topicIds={pendingFinalize.map((d) => d.topic.id)} />
      )}
      {pending.length > 0 && (
        <ChairBulkApproveButton topicIds={pending.map((d) => d.topic.id)} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 whitespace-nowrap">Chủ tịch Hội đồng</h1>
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
                    <span className="inline-flex items-center gap-1" title={s.location}>
                      <MapPin className="w-3.5 h-3.5 text-red-400" />
                      {s.location || "Chưa cập nhật phòng"}
                    </span>
                    <span className="text-slate-300">—</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      {fmtDate(s.date)}
                      {sessionLabel && <span className="text-slate-400"> · {sessionLabel}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Danh sách hội đồng bạn làm Chủ tịch — phê duyệt hoàn tất quy trình KLTN
        </p>
      </div>

      <Card title={`Tất cả hội đồng (${valid.length})`}
        action={(pending.length > 0 || pendingFinalize.length > 0) ? bulkAction : undefined}
      >
        {valid.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Crown className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Bạn chưa làm Chủ tịch hội đồng nào</p>
          </div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Sinh viên</Th>
                <Th>Đề tài</Th>
                <Th>GVHD</Th>
                <Th>GVPB</Th>
                <Th>Trạng thái</Th>
                <Th>Thao tác</Th>
              </tr>
            </Thead>
            <Tbody>
              {valid.map((d) => (
                <Tr key={d.topic.id}>
                  <Td className="whitespace-nowrap">
                    <p className="font-medium text-slate-800">{d.student?.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{d.student?.student_code}</p>
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-700 leading-snug">{d.topic.title}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-sm text-slate-700">{d.supervisor?.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{d.supervisor?.email ?? ""}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-sm text-slate-700">{d.reviewer?.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{d.reviewer?.email ?? ""}</p>
                  </Td>
                  <Td>
                    <TopicStatusBadge status={d.topic.current_status} type="KLTN" />
                  </Td>
                  <Td>
                    {d.topic.current_status === "HOAN_TAT" ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất
                      </span>
                    ) : d.topic.current_status === "CHO_CHU_TICH_DUYET" ? (
                      <Link
                        href={`/council/topics/${d.topic.id}`}
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        Xem tài liệu & Phê duyệt →
                      </Link>
                    ) : d.topic.current_status === "CHO_THU_KY_XAC_NHAN" ? (
                      <ChairFinalizeInlineButton topicId={d.topic.id} />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" /> Đang xử lý
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
