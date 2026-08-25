export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { PASSING_SCORE } from "@/lib/constants";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { ReviewerFilterTable } from "./reviewer-filter-table";
import { autoPassUngradedGVHD } from "@/app/actions/topic.actions";

export default async function ReviewerDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  // Auto-pass GVHD: luôn chạy khi GVPB load, để thấy ngay đề tài được pass sẵn
  try {
    await autoPassUngradedGVHD();
  } catch {
    /* silent */
  }

  const allTopics = await db.topics.filter({ reviewer_id: userId });

  const visibleTopics = await Promise.all(
    allTopics.map(async (t) => {
      const scores = await db.scores.filter({
        topic_id: t.id,
        score_role: "SUPERVISOR",
      });
      const supervisorScore = scores[0] ? Number(scores[0].score_value) : null;
      // Cho phép GVPB chấm song song: hiển thị khi GVHD chưa chấm HOẶC GVHD chấm đạt.
      // Chỉ ẩn khi GVHD đã chấm KHÔNG ĐẠT (< 5).
      const isVisible =
        supervisorScore === null || supervisorScore >= PASSING_SCORE;
      const student = await db.users.findById(t.student_id);
      const myScore = await db.scores.filter({
        topic_id: t.id,
        scorer_id: userId,
        score_role: "REVIEWER",
      });
      return {
        ...t,
        isVisible,
        supervisorScore,
        student,
        myScore: myScore[0] ?? null,
      };
    }),
  );

  const visible = visibleTopics.filter((t) => t.isVisible);
  const hidden = visibleTopics.filter((t) => !t.isVisible);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Dashboard Giảng viên phản biện
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hiển thị hồ sơ chưa có điểm GVHD hoặc GVHD đã chấm đạt ({">"}{" "}
          {PASSING_SCORE} điểm). Ẩn khi GVHD chấm KHÔNG ĐẠT.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-600">Hồ sơ cần phản biện ({visible.length})</h2>
        {visible.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Chưa có hồ sơ nào sẵn sàng</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">Hồ sơ sẽ xuất hiện khi giảng viên hướng dẫn đã chấm điểm đạt</p>
          </div>
        ) : (
          <ReviewerFilterTable
            topics={visible.map((t) => ({
              id: t.id,
              title: t.title,
              topic_type: t.topic_type,
              current_status: t.current_status,
              supervisorScore: t.supervisorScore,
              myScore: t.myScore ? Number(t.myScore.score_value) : null,
              student: t.student ? {
                full_name: t.student.full_name,
                student_code: t.student.student_code ?? "",
                department: t.student.department ?? "",
                major: t.student.major ?? "",
              } : null,
            }))}
          />
        )}
      </div>

      {hidden.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-500">
          <Lock className="w-4 h-4 text-slate-400" />
          <span>
            Còn <strong>{hidden.length}</strong> hồ sơ đang chờ GVHD chấm điểm
            đạt để mở phản biện
          </span>
        </div>
      )}
    </div>
  );
}
