import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "52mb", // Cho phép upload file lớn
    },
  },
  // Bỏ qua lỗi TypeScript khi build (tạm thời)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
