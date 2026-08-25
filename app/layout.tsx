import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/layout/session-provider";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hệ thống Quản lý KLTN",
  description: "Quản lý quy trình Khóa luận tốt nghiệp và Báo cáo thực tập",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={geist.className} suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
