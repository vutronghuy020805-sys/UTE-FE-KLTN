export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { redirect } from "next/navigation";
import { Card, Table, Thead, Tbody, Th, Td, Tr, EmptyState } from "@/components/ui/index";
import { FileText, Clock, CheckCircle2 } from "lucide-react";
import { RevisionInlineActions, RevisionResendAction } from "./revision-actions";
import { calculateTotalScore, PASSING_SCORE } from "@/lib/constants";

type TopicRow = Record<string, string>;
type FileRow = Record<string, string>;
type UserRow = Record<string, string>;
type ScoreRow = Record<string, string>;

interface RevisionRow {
  id: string;
  title: string;
  status: string;
  student: UserRow | null;
  chinhSuaFile: FileRow | null;
  giaiTrinhFile: FileRow | null;
  bbhdFile: FileRow | null;
  finalScore: number | null;
}

async function buildRow(
  t: TopicRow,
  files: FileRow[],
  scores: ScoreRow[],
): Promise<RevisionRow> {
  const student = t.student_id ? await db.users.findById(t.student_id) : null;
  const topicFiles = files.filter((f) => f.topic_id === t.id);
  const topicScores = scores.filter((s) => s.topic_id === t.id);

  const pickLatest = (type: string) =>
    topicFiles
      .filter((f) => f.file_type === type)
      .sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))[0] ?? null;

  const supScore = topicScores.find((s) => s.score_role === "SUPERVISOR");
  const revScore = topicScores.find((s) => s.score_role === "REVIEWER");
  const committeeScores = topicScores
    .filter((s) => s.score_role === "COMMITTEE_MEMBER")
    .map((s) => Number(s.score_value))
    .filter((v) => !Number.isNaN(v));

  const finalScore = calculateTotalScore(
    supScore ? Number(supScore.score_value) : undefined,
    revScore ? Number(revScore.score_value) : undefined,
    committeeScores,
  );

  return {
    id: t.id,
    title: t.title,
    status: t.current_status,
    student,
    chinhSuaFile: pickLatest("CHINH_SUA"),
    giaiTrinhFile: pickLatest("PHIEU_GIAI_TRINH"),
    bbhdFile: pickLatest("BIEN_BAN_HOI_DONG"),
    finalScore,
  };
}

function FileLink({ file, color }: { file: FileRow | null; color: "blue" | "green" | "amber" }) {
  if (!file) {
    return <span className="text-xs text-slate-400 italic">—</span>;
  }
  const colorCls =
    color === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      : color === "green"
        ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
  return (
    <a
      href={file.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${colorCls}`}
      title={file.original_name}
    >
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span>Xem</span>
    </a>
  );
}

function FinalScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-slate-400 italic">—</span>;
  }
  const passed = score >= PASSING_SCORE;
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-sm font-bold ${
        passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
      title={passed ? "Đạt" : "Không đạt"}
    >
      {score.toFixed(2)}
    </span>
  );
}

function RevisionTable({ rows, mode }: { rows: RevisionRow[]; mode: "review" | "sent" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-auto">
      <Table>
        <Thead>
          <tr>
            <Th>Sinh viên</Th>
            <Th>Đề tài</Th>
            <Th><div className="flex justify-center">Điểm HĐ</div></Th>
            <Th><div className="flex justify-center">BB HĐ</div></Th>
            <Th><div className="flex justify-center">KLTN sửa</div></Th>
            <Th><div className="flex justify-center">Giải trình</div></Th>
            <Th><div className="flex justify-center">Hành động</div></Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>
                <p className="font-medium text-slate-800 whitespace-nowrap">
                  {r.student?.full_name ?? "—"}
                </p>
                <p className="text-xs text-slate-400">{r.student?.student_code}</p>
                <p className="text-xs text-slate-400">{r.student?.department || ""}</p>
              </Td>
              <Td>
                <p
                  className="text-sm text-slate-700 max-w-xs leading-snug line-clamp-2"
                  title={r.title}
                >
                  {r.title}
                </p>
              </Td>
              <Td>
                <div className="flex justify-center">
                  <FinalScore score={r.finalScore} />
                </div>
              </Td>
              <Td><div className="flex justify-center"><FileLink file={r.bbhdFile} color="amber" /></div></Td>
              <Td><div className="flex justify-center"><FileLink file={r.chinhSuaFile} color="blue" /></div></Td>
              <Td><div className="flex justify-center"><FileLink file={r.giaiTrinhFile} color="green" /></div></Td>
              <Td>
                {mode === "review" ? (
                  <RevisionInlineActions topicId={r.id} />
                ) : (
                  <RevisionResendAction topicId={r.id} />
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

export default async function SupervisorRevisionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const myTopics = await db.topics.filter({ supervisor_id: userId });
  const relevant = myTopics.filter(
    (t) =>
      t.topic_type !== "BCTT" &&
      ["CHO_GVHD_XAC_NHAN", "CHO_CHU_TICH_DUYET"].includes(t.current_status),
  );

  const [allFiles, allScores] = relevant.length > 0
    ? await Promise.all([db.files.getAll(), db.scores.getAll()])
    : [[] as FileRow[], [] as ScoreRow[]];

  const rows = await Promise.all(relevant.map((t) => buildRow(t, allFiles, allScores)));
  const pending = rows.filter((r) => r.status === "CHO_GVHD_XAC_NHAN");
  const sentToChair = rows.filter((r) => r.status === "CHO_CHU_TICH_DUYET");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Xét chỉnh sửa của sinh viên</h1>
        <p className="text-sm text-slate-500 mt-1">
          Danh sách đề tài KLTN sinh viên đã nộp tài liệu chỉnh sửa, chờ GVHD xét duyệt
          hoặc đang chờ Chủ tịch HĐ phê duyệt lần cuối.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-amber-700">
            Chờ GVHD xét duyệt ({pending.length})
          </h2>
        </div>
        {pending.length === 0 ? (
          <Card>
            <EmptyState
              title="Không có đề tài nào chờ xét"
              description="Khi sinh viên nộp tài liệu chỉnh sửa, đề tài sẽ xuất hiện ở đây."
            />
          </Card>
        ) : (
          <RevisionTable rows={pending} mode="review" />
        )}
      </div>

      {sentToChair.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-green-700">
              Đã gửi Chủ tịch HĐ phê duyệt ({sentToChair.length})
            </h2>
          </div>
          <RevisionTable rows={sentToChair} mode="sent" />
        </div>
      )}
    </div>
  );
}
