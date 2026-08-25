import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Không có quyền truy cập</h1>
        <p className="text-slate-500 mb-6">
          Bạn không có quyền xem trang này. Nếu bạn cho rằng đây là nhầm lẫn,
          vui lòng liên hệ Quản trị viên hệ thống.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Về trang chủ
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Đăng nhập lại
          </Link>
        </div>
      </div>
    </div>
  );
}
