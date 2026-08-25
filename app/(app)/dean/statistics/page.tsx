export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { CommitteeExportTable, type CommitteeRow } from "./committee-export-table";
import { filterTopicsByDeanMajor } from "@/lib/permissions";

export default async function DeanStatisticsPage() {
  const [allTopicsAll, allUsers, allCommittees, allCommitteeTopics] = await Promise.all([
    db.topics.getAll(),
    db.users.getAll(),
    db.committees.getAll(),
    db.committeeTopics.getAll(),
  ]);

  // Lọc theo ngành của TBM
  const allTopics = await filterTopicsByDeanMajor(allTopicsAll);
  const myTopicIds = new Set(allTopics.map((t) => t.id));

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Bảng hội đồng — chỉ HĐ có ít nhất 1 SV thuộc ngành của TBM
  const committeeRows: CommitteeRow[] = allCommittees
    .map((c) => {
      const myTopicsInCommittee = allCommitteeTopics.filter(
        (a) => a.committee_id === c.id && myTopicIds.has(a.topic_id),
      );
      if (myTopicsInCommittee.length === 0) return null;
      const chair = c.chair_id ? userMap.get(c.chair_id) : null;
      const secretary = c.secretary_id ? userMap.get(c.secretary_id) : null;
      const date = c.defense_date
        ? new Date(c.defense_date).toLocaleDateString("vi-VN")
        : "—";
      return {
        committeeId: c.id,
        committeeName: c.committee_name ?? "—",
        chairName: chair?.full_name ?? "—",
        secretaryName: secretary?.full_name ?? "—",
        defenseDate: date,
        studentCount: myTopicsInCommittee.length,
      } satisfies CommitteeRow;
    })
    .filter((r): r is CommitteeRow => r !== null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tải biên bản hội đồng</h1>
        <p className="text-sm text-slate-500 mt-1">Tải biên bản và bảng điểm theo từng hội đồng</p>
      </div>

      <CommitteeExportTable rows={committeeRows} />
    </div>
  );
}

