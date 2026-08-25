/**
 * Tạo thư mục gốc trên Google Drive bằng tài khoản admin
 * Chạy: node scripts/create-root-folder.mjs
 */

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

const CLIENT_ID = env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_DRIVE_REFRESH_TOKEN;

// Lấy access token từ refresh token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const { access_token, error } = await tokenRes.json();
if (error) { console.error("Lỗi lấy access token:", error); process.exit(1); }

// Tạo folder gốc
const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "KLTN_Files",
    mimeType: "application/vnd.google-apps.folder",
  }),
});
const folder = await createRes.json();
if (folder.error) { console.error("Lỗi tạo folder:", folder.error); process.exit(1); }

console.log("\n✅ Tạo thư mục thành công!");
console.log(`   ID  : ${folder.id}`);
console.log(`   Link: ${folder.webViewLink}`);
console.log("\n📋 Cập nhật vào .env.local:");
console.log(`   GOOGLE_DRIVE_FOLDER_ID=${folder.id}`);
console.log(`   GOOGLE_DRIVE_ROOT_FOLDER_ID=${folder.id}`);
