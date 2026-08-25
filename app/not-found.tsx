import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Không tìm thấy trang</h1>
        <p className="text-slate-500 mb-6">
          Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
