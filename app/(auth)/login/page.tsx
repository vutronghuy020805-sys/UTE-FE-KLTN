"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, Suspense } from "react";

// Error messages map
const ERROR_MESSAGES: Record<string, string> = {
  NotRegistered: "Email của bạn chưa được đăng ký trong hệ thống. Vui lòng liên hệ Admin.",
  Disabled: "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Admin.",
  OAuthAccountNotLinked: "Email này đã được đăng ký bằng phương thức khác.",
  OAuthSignin: "Có lỗi khi kết nối với Google. Vui lòng thử lại.",
  default: "Đã xảy ra lỗi. Vui lòng thử lại.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.default) : null;

  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
    // loading sẽ tự reset nếu bị lỗi redirect trở về
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/bg-login.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlay tối để form dễ đọc */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-linear-to-r from-blue-700 to-blue-600 px-8 py-8 text-white text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 bg-white flex items-center justify-center p-1">
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b9/Logo_Tr%C6%B0%E1%BB%9Dng_%C4%90%E1%BA%A1i_H%E1%BB%8Dc_S%C6%B0_Ph%E1%BA%A1m_K%E1%BB%B9_Thu%E1%BA%ADt_TP_H%E1%BB%93_Ch%C3%AD_Minh.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold">Hệ thống Quản lý KLTN</h1>
            <p className="text-blue-200 text-sm mt-1">Khoa Kinh tế</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-2 text-center">
              Đăng nhập
            </h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              Sử dụng tài khoản Google của trường để đăng nhập
            </p>

            {/* Error message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 text-center">
                {errorMessage}
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-sm font-semibold text-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                // Google SVG logo
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {loading ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
            </button>

            {/* Info note */}
            <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700 text-center leading-relaxed">
                ⚠️ Chỉ tài khoản Google đã được Admin đăng ký trong hệ thống mới có thể đăng nhập.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-4">
          © {new Date().getFullYear()} Khoa Kinh tế
        </p>
      </div>
    </div>
  );
}

// Bọc Suspense vì useSearchParams cần nó trong Next.js App Router
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
