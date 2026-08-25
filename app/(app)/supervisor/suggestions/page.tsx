export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui/index";
import { redirect } from "next/navigation";
import { Lightbulb, BookOpen, Microscope, Code2, BarChart3, Globe, Cpu } from "lucide-react";

const SUGGESTION_FIELDS = [
  { icon: Code2,       color: "blue",   label: "Công nghệ phần mềm",     topics: ["Hệ thống quản lý thông minh", "Ứng dụng di động đa nền tảng", "Microservices & DevOps"] },
  { icon: Microscope,  color: "purple", label: "Trí tuệ nhân tạo",       topics: ["Nhận diện hình ảnh bằng Deep Learning", "Xử lý ngôn ngữ tự nhiên tiếng Việt", "Hệ thống gợi ý sản phẩm"] },
  { icon: BarChart3,   color: "green",  label: "Khoa học dữ liệu",       topics: ["Phân tích dữ liệu mạng xã hội", "Dự báo nhu cầu bằng Machine Learning", "Khai phá dữ liệu giáo dục"] },
  { icon: Globe,       color: "amber",  label: "Hệ thống thông tin",     topics: ["Chuyển đổi số doanh nghiệp vừa và nhỏ", "Bảo mật dữ liệu và quyền riêng tư", "Hệ thống ERP tùy chỉnh"] },
  { icon: Cpu,         color: "rose",   label: "IoT & Nhúng",            topics: ["Nhà thông minh với IoT", "Giám sát môi trường thời gian thực", "Hệ thống điều khiển tự động"] },
];

export default async function SuggestionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Gợi ý đề tài</h1>
        <p className="text-sm text-slate-500 mt-1">
          Danh sách hướng nghiên cứu và đề tài gợi ý cho sinh viên đăng ký KLTN
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Lightbulb className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Hướng dẫn cho sinh viên</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Sinh viên quan tâm đến các đề tài dưới đây có thể liên hệ trực tiếp với giảng viên để đăng ký hướng dẫn.
            Vui lòng chuẩn bị ý tưởng sơ bộ và đề xuất nghiên cứu trước khi liên hệ.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUGGESTION_FIELDS.map((field) => {
          const Icon = field.icon;
          const colors: Record<string, { card: string; badge: string; icon: string }> = {
            blue:   { card: "border-blue-200 bg-blue-50",     badge: "bg-blue-100 text-blue-700",   icon: "text-blue-500" },
            purple: { card: "border-purple-200 bg-purple-50", badge: "bg-purple-100 text-purple-700", icon: "text-purple-500" },
            green:  { card: "border-green-200 bg-green-50",   badge: "bg-green-100 text-green-700", icon: "text-green-500" },
            amber:  { card: "border-amber-200 bg-amber-50",   badge: "bg-amber-100 text-amber-700", icon: "text-amber-500" },
            rose:   { card: "border-rose-200 bg-rose-50",     badge: "bg-rose-100 text-rose-700",   icon: "text-rose-500" },
          };
          const c = colors[field.color];
          return (
            <div key={field.label} className={`border rounded-xl p-4 ${c.card}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${c.icon}`} />
                <p className="text-sm font-semibold text-slate-800">{field.label}</p>
              </div>
              <div className="space-y-2">
                {field.topics.map((topic) => (
                  <div key={topic} className="flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700">{topic}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card title="Liên hệ đăng ký">
        <p className="text-sm text-slate-600">
          Sinh viên có thể đăng ký hướng dẫn trực tiếp qua hệ thống bằng cách chọn giảng viên khi đăng ký đề tài.
          Đề tài có thể điều chỉnh tên và hướng nghiên cứu sau khi thảo luận với giảng viên hướng dẫn.
        </p>
      </Card>
    </div>
  );
}
