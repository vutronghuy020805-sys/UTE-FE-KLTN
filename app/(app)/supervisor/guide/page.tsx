export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui/index";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

const STEPS = [
  {
    step: "1",
    title: "Xác nhận nhận hướng dẫn",
    color: "blue",
    desc: "Khi sinh viên đăng ký, bạn nhận được thông báo. Vào mục Sinh viên hướng dẫn → xem đề tài → Xác nhận nhận hướng dẫn.",
  },
  {
    step: "2",
    title: "Theo dõi tiến độ",
    color: "indigo",
    desc: "Sinh viên thực hiện KLTN. Bạn có thể xem hồ sơ và file đã nộp bất kỳ lúc nào qua mục Sinh viên hướng dẫn.",
  },
  {
    step: "3",
    title: "Chấm điểm GVHD",
    color: "violet",
    desc: "Sau khi sinh viên nộp bài, hệ thống chuyển sang trạng thái CHO_CHAM_HUONG_DAN. Vào Chi tiết đề tài → nhập điểm theo 7 tiêu chí.",
  },
  {
    step: "4",
    title: "Xác nhận chỉnh sửa sau bảo vệ",
    color: "purple",
    desc: "Nếu hội đồng yêu cầu chỉnh sửa, sinh viên sẽ nộp 3 file. Bạn cần xác nhận sinh viên đã hoàn thành để chuyển sang Chủ tịch duyệt.",
  },
];

const TIPS = [
  "Điểm GVHD tính 20% vào điểm tổng kết của sinh viên.",
  "Sau khi chấm điểm đạt (≥ 5/10), đề tài tự động chuyển sang phân công GVPB.",
  "Sinh viên không thể xem điểm số trực tiếp — chỉ thấy trạng thái Đã chấm/Chưa chấm.",
  "Khi xác nhận chỉnh sửa, bạn chỉ cần kiểm tra 3 file: Khóa luận sửa, Biên bản HĐ, Phiếu giải trình.",
];

export default async function SupervisorGuidePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hướng dẫn sử dụng</h1>
        <p className="text-sm text-slate-500 mt-1">Quy trình và hướng dẫn cho Giảng viên Hướng dẫn (GVHD)</p>
      </div>

      <Card title="Quy trình GVHD">
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const colors: Record<string, string> = {
              blue:   "bg-blue-100 text-blue-700 border-blue-200",
              indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
              violet: "bg-violet-100 text-violet-700 border-violet-200",
              purple: "bg-purple-100 text-purple-700 border-purple-200",
            };
            return (
              <div key={s.step} className="flex gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${colors[s.color]}`}>
                    {s.step}
                  </div>
                  {i < STEPS.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Lưu ý quan trọng">
        <div className="space-y-2.5">
          {TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{tip}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Vai trò khác của giảng viên">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: BookOpen, label: "Giảng viên Phản biện (GVPB)", desc: "Chấm điểm phản biện (20% điểm tổng)", href: "/reviewer/dashboard" },
            { icon: CheckCircle2, label: "Thành viên Hội đồng", desc: "Tham gia buổi bảo vệ, chấm điểm HĐ (60%)", href: "/council/dashboard" },
            { icon: ArrowRight, label: "Chủ tịch Hội đồng", desc: "Phê duyệt hoàn tất quy trình sau chỉnh sửa", href: "/council/chair" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href}
                className="flex flex-col gap-1.5 p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <Icon className="w-5 h-5 text-slate-400" />
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
