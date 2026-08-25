/**
 * Script lấy Google Drive refresh token cho admin
 * Chạy: node scripts/get-drive-token.mjs
 */

import * as http from "http";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter(line => line.includes("=") && !line.startsWith("#"))
    .map(line => { const [k, ...v] = line.split("="); return [k.trim(), v.join("=").trim()]; })
);

// Desktop app credentials — đọc từ .env.local
const CLIENT_ID = env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:9999/callback";
const PORT = 9999;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Thiếu GOOGLE_DRIVE_CLIENT_ID hoặc GOOGLE_DRIVE_CLIENT_SECRET trong .env.local");
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive")}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log("\n=== LẤY GOOGLE DRIVE REFRESH TOKEN ===\n");
console.log("1. Mở link này trong trình duyệt:\n");
console.log(authUrl);
console.log("\n2. Đăng nhập bằng bmqtkd@hcmute.edu.vn → Cho phép Drive");
console.log("3. Chờ tự động lấy code...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("Không tìm thấy code.");
    return;
  }

  res.end("<h2>Thành công! Quay lại terminal để xem refresh token.</h2>");
  server.close();

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const data = await tokenRes.json();

    if (data.error) {
      console.error("Lỗi:", data.error, data.error_description);
      return;
    }

    console.log("✅ Thành công! Thêm dòng này vào .env.local:\n");
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);
  } catch (err) {
    console.error("Lỗi:", err);
  }
});

server.listen(PORT, () => {
  console.log(`Đang chờ callback tại http://localhost:${PORT}/callback ...`);
});
