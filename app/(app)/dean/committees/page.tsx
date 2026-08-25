export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card, EmptyState } from "@/components/ui/index";
import { Users, ClipboardList, Plus, Upload } from "lucide-react";
import { CreateCommitteeForm } from "@/app/(app)/dean/committees/create-committee-form";
import { CommitteesFilterSection } from "./committees-filter-section";
import { filterTopicsByDeanMajor, getDeanScopeMajor } from "@/lib/permissions";
import { autoPassUngradedGVHD } from "@/app/actions/topic.actions";

export default async function DeanCommitteesPage() {
  // Auto-pass GVHD trước khi tính danh sách chờ xếp — đảm bảo topic chưa có điểm GVHD
  // cũng được auto-pass 5đ và vào list "Chờ xếp hội đồng".
  try {
    await autoPassUngradedGVHD();
  } catch {
    /* silent */
  }

  const [allTopicsAll, allUsers, allCommittees, allAssignments, allScores, allFiles, scopeMajor] = await Promise.all([
    db.topics.getAll(),
    db.users.getAll(),
    db.committees.getAll().catch(() => [] as Record<string, string>[]),
    db.committeeTopics.getAll().catch(() => [] as Record<string, string>[]),
    db.scores.getAll().catch(() => [] as Record<string, string>[]),
    db.files.getAll().catch(() => [] as Record<string, string>[]),
    getDeanScopeMajor(),
  ]);

  // Set topic_id có file bài làm + có file turnitin
  const baiLamTopicIds = new Set<string>();
  const turnitinTopicIds = new Set<string>();
  for (const f of allFiles) {
    if (["KHOA_LUAN", "BAO_CAO"].includes(f.file_type)) baiLamTopicIds.add(f.topic_id);
    if (f.file_type === "TURNITIN") turnitinTopicIds.add(f.topic_id);
  }

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

  // Lọc topic theo ngành của TBM
  const allTopics = await filterTopicsByDeanMajor(allTopicsAll);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const allLecturers = allUsers.filter((u) => ["LECTURER", "DEAN"].includes(u.system_role));

  // GV cùng ngành của TBM — dùng cho Chủ tịch + Thành viên HĐ
  const sameMajorLecturers = scopeMajor
    ? allLecturers.filter((l) => (l.major || l.department || "").trim() === scopeMajor)
    : allLecturers;

  // Tất cả GV — dùng cho Thư ký (không cần cùng ngành)
  const lecturerOptions = sameMajorLecturers.map((l) => ({ value: l.id, label: l.full_name }));
  const allLecturerOptions = allLecturers.map((l) => ({ value: l.id, label: l.full_name }));

  // Map committee_id → topic ids
  const assignmentsByCommittee = new Map<string, string[]>();
  for (const a of allAssignments) {
    if (!assignmentsByCommittee.has(a.committee_id)) assignmentsByCommittee.set(a.committee_id, []);
    assignmentsByCommittee.get(a.committee_id)!.push(a.topic_id);
  }

  // Set topic ids đã có hội đồng
  const assignedTopicIds = new Set(allAssignments.map((a) => a.topic_id));

  // Đề tài chờ phân công: TẤT CẢ đề tài đã đăng ký, chưa có HĐ, chưa kết thúc.
  // Bao gồm cả đề tài không đạt (KHONG_DAT_*) — sẽ tô màu đỏ trong UI để TBM nhận diện.
  // Loại trừ:
  //  - Đã có HĐ (assignedTopicIds)
  //  - Đã hoàn tất (HOAN_TAT)
  //  - GVHD từ chối (GVHD_TU_CHOI)
  //  - Chưa được TBM/GVHD duyệt (MOI_DANG_KY, CHO_GVHD_DUYET, CHO_TRUONG_KHOA_DUYET)
  const INELIGIBLE_STATUSES = [
    "HOAN_TAT",
    "GVHD_TU_CHOI",
    "MOI_DANG_KY",
    "CHO_GVHD_DUYET",
    "CHO_TRUONG_KHOA_DUYET",
  ];
  const pendingTopics = allTopics.filter(
    (t) =>
      !assignedTopicIds.has(t.id) &&
      !INELIGIBLE_STATUSES.includes(t.current_status),
  );

  // Nhóm hội đồng theo ngày bảo vệ
  const committeesByDate = new Map<string, typeof allCommittees>();
  for (const c of allCommittees) {
    const date = c.defense_date?.split("T")[0] ?? "Chưa xác định";
    if (!committeesByDate.has(date)) committeesByDate.set(date, []);
    committeesByDate.get(date)!.push(c);
  }
  const sortedDates = Array.from(committeesByDate.keys()).sort((a, b) => b.localeCompare(a));

  // GV đã phân công theo (ngày + buổi) — để chặn trùng trong cùng 1 buổi,
  // nhưng cho phép GV tham gia sáng + chiều cùng ngày.
  // Key = "YYYY-MM-DD|SESSION" (SESSION: MORNING | AFTERNOON | "" nếu chưa xếp)
  const usedGvByDateSession: Record<string, string[]> = {};
  for (const c of allCommittees) {
    const date = c.defense_date?.split("T")[0] ?? "";
    if (!date) continue;
    const session = c.defense_session ?? "";
    const key = `${date}|${session}`;
    if (!usedGvByDateSession[key]) usedGvByDateSession[key] = [];
    [c.chair_id, c.secretary_id, c.member_1_id, c.member_2_id, c.member_3_id, c.member_4_id, c.member_5_id]
      .filter(Boolean)
      .forEach((id) => {
        if (!usedGvByDateSession[key].includes(id)) usedGvByDateSession[key].push(id);
      });
  }

  // Pre-resolve committee items for the client filter component
  const committeeItems = allCommittees.map((c) => {
    const chair = c.chair_id ? userMap.get(c.chair_id) : null;
    const secretary = c.secretary_id ? userMap.get(c.secretary_id) : null;
    const memberIds = [c.member_1_id, c.member_2_id, c.member_3_id, c.member_4_id, c.member_5_id].filter(Boolean);
    const members = memberIds
      .map((id) => userMap.get(id!))
      .filter(Boolean)
      .map((m) => ({ id: m!.id, full_name: m!.full_name }));
    return {
      id: c.id,
      committee_name: c.committee_name ?? "",
      defense_date: c.defense_date?.split("T")[0] ?? "Chưa xác định",
      defense_session: c.defense_session ?? "",
      defense_location: c.defense_location ?? "",
      chair: chair ? { id: chair.id, full_name: chair.full_name } : null,
      secretary: secretary ? { id: secretary.id, full_name: secretary.full_name } : null,
      members,
      topicCount: assignmentsByCommittee.get(c.id)?.length ?? 0,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Hội đồng</h1>
          <p className="text-sm text-slate-500 mt-1">Tạo hội đồng, phân công GV và thêm sinh viên</p>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Hội đồng đã tạo</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{allCommittees.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">hội đồng</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Đề tài đã xếp HĐ</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{assignedTopicIds.size}</p>
          <p className="text-xs text-slate-400 mt-0.5">đề tài</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Chờ xếp hội đồng</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingTopics.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">đề tài</p>
        </div>
      </div>

      {/* Tạo hội đồng mới */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-slate-500" />
          Tạo hội đồng mới
        </h2>
        <Card>
          <CreateCommitteeForm
            lecturers={lecturerOptions}
            secretaryLecturers={allLecturerOptions}
            usedGvByDateSession={usedGvByDateSession}
          />
        </Card>
      </section>

      {/* Danh sách hội đồng theo ngày */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Hội đồng đã tạo</h2>

        {allCommittees.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="w-7 h-7 text-slate-400" />}
              title="Chưa có hội đồng nào"
              description="Tạo hội đồng ở trên, sau đó thêm sinh viên vào từng hội đồng"
            />
          </Card>
        ) : (
          <CommitteesFilterSection committees={committeeItems} sortedDates={sortedDates} />
        )}
      </section>

      {/* Đề tài chờ xếp hội đồng */}
      {pendingTopics.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            Đề tài chờ xếp hội đồng
            <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {pendingTopics.length}
            </span>
          </h2>
          <Card>
            <div className="flex items-center gap-3 pb-2 mb-1 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              <div className="flex-1" />
              <div className="w-14 text-center">GVHD</div>
              <div className="w-14 text-center">GVPB</div>
              <div className="w-20 text-center">File bài làm</div>
              <div className="w-20 text-center">Turnitin</div>
            </div>
            <div className="divide-y divide-slate-100">
              {pendingTopics.map((t) => {
                const student = userMap.get(t.student_id);
                const supervisor = t.supervisor_id ? userMap.get(t.supervisor_id) : null;
                const reviewer = t.reviewer_id ? userMap.get(t.reviewer_id) : null;
                const gvhdScore = supervisorScoreByTopicId.get(t.id);
                const gvpbScore = reviewerScoreByTopicId.get(t.id);
                const isGvhdFailed = gvhdFailedTopicIds.has(t.id);
                const isGvpbFailed = gvpbScore !== undefined && gvpbScore < 5;
                const isFailed = isGvhdFailed || isGvpbFailed;
                return (
                  <div key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isFailed ? "text-red-600" : "text-slate-800"}`}>{t.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-slate-500">SV: {student?.full_name}{student?.student_code ? ` (${student.student_code})` : ""}</span>
                        <span className="text-xs text-slate-400">GVHD: {supervisor?.full_name ?? "—"}</span>
                        <span className="text-xs text-slate-400">GVPB: {reviewer?.full_name ?? "—"}</span>
                      </div>
                    </div>
                    <div className="w-14 shrink-0 text-center text-sm">
                      {gvhdScore === undefined ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={`font-bold tabular-nums ${isGvhdFailed ? "text-red-600" : gvhdScore >= 5 ? "text-green-700" : "text-slate-700"}`}>
                          {gvhdScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="w-14 shrink-0 text-center text-sm">
                      {gvpbScore === undefined ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={`font-bold tabular-nums ${isGvpbFailed ? "text-red-600" : gvpbScore >= 5 ? "text-green-700" : "text-slate-700"}`}>
                          {gvpbScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="w-20 shrink-0 flex justify-center">
                      <Upload
                        className={`w-4 h-4 ${baiLamTopicIds.has(t.id) ? "text-blue-600" : "text-slate-300"}`}
                      />
                    </div>
                    <div className="w-20 shrink-0 flex justify-center">
                      <Upload
                        className={`w-4 h-4 ${turnitinTopicIds.has(t.id) ? "text-blue-600" : "text-slate-300"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
