export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { redirect } from "next/navigation";
import { User, BookOpen, Users, Award, BarChart3 } from "lucide-react";
import { SignatureUpload } from "./signature-upload";

export default async function SupervisorInfoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [user, allTopics, allQuotas, allCommittees] = await Promise.all([
    db.users.findById(userId),
    db.topics.filter({ supervisor_id: userId }),
    db.quotas.getAll(),
    db.committees.getAll(),
  ]);
  const quotas = allQuotas.filter((q) => q.lecturer_id === userId);

  const activeTopics = allTopics.filter(
    (t) => !["HOAN_TAT", "GVHD_TU_CHOI", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN"].includes(t.current_status),
  );
  const completedTopics = allTopics.filter((t) => t.current_status === "HOAN_TAT");

  const reviewerTopics = await db.topics.filter({ reviewer_id: userId });

  const myChairCommittees = allCommittees.filter((c) => c.chair_id === userId);
  const myMemberCommittees = allCommittees.filter(
    (c) =>
      c.member_1_id === userId || c.member_2_id === userId ||
      c.member_3_id === userId || c.member_4_id === userId ||
      c.member_5_id === userId,
  );

  const activeQuota = quotas[quotas.length - 1]; // lấy quota gần nhất

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Thông tin chung</h1>
        <p className="text-sm text-slate-500 mt-1">Tổng quan về vai trò và hoạt động của bạn trong hệ thống</p>
      </div>

      {/* Thông tin cá nhân */}
      <Card title="Thông tin giảng viên">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={User} label="Họ và tên" value={user?.full_name ?? "—"} />
          <InfoRow icon={User} label="Email" value={user?.email ?? "—"} />
          <InfoRow icon={BookOpen} label="Khoa / Bộ môn" value={user?.department ?? "—"} />
          <InfoRow icon={User} label="Điện thoại" value={user?.phone ?? "—"} />
        </div>
      </Card>

      {/* Chữ ký điện tử */}
      <SignatureUpload
        currentSignatureUrl={user?.signature_url}
        currentFileId={user?.signature_file_id}
      />

      {/* Thống kê hoạt động */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} color="blue" label="Đang hướng dẫn" value={activeTopics.length} />
        <StatCard icon={Award} color="green" label="Hoàn tất" value={completedTopics.length} />
        <StatCard icon={BarChart3} color="purple" label="Phản biện" value={reviewerTopics.length} />
        <StatCard icon={Users} color="amber" label="Hội đồng (Chủ tịch)" value={myChairCommittees.length} />
      </div>

      {/* Hạn mức hướng dẫn */}
      {activeQuota && (
        <Card title="Hạn mức hướng dẫn hiện tại">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Năm học / Học kỳ</span>
              <span className="font-medium text-slate-800">
                {activeQuota.academic_year} — HK{activeQuota.semester} (Đợt {activeQuota.batch})
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Đã nhận hướng dẫn</span>
              <span className="font-semibold text-blue-700">
                {activeQuota.current_count} / {activeQuota.quota} sinh viên
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (Number(activeQuota.current_count) / Number(activeQuota.quota)) * 100)}%` }}
              />
            </div>
            {activeQuota.department && (
              <p className="text-xs text-slate-400">Áp dụng cho ngành: {activeQuota.department}</p>
            )}
          </div>
        </Card>
      )}

      {/* Vai trò hội đồng */}
      <Card title="Vai trò trong hội đồng">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800">Chủ tịch Hội đồng</p>
            <p className="text-3xl font-black text-amber-700 mt-1">{myChairCommittees.length}</p>
            <p className="text-xs text-amber-600 mt-0.5">hội đồng đang/đã làm Chủ tịch</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-semibold text-slate-700">Thành viên Hội đồng</p>
            <p className="text-3xl font-black text-slate-700 mt-1">{myMemberCommittees.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">hội đồng tham gia với tư cách thành viên</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, color, label, value,
}: { icon: React.ElementType; color: string; label: string; value: number }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-400", green: "text-green-400",
    purple: "text-purple-400", amber: "text-amber-400",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <Icon className={`w-5 h-5 mb-2 ${iconColors[color]}`} />
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
