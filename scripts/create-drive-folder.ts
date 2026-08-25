/**
 * Tạo thư mục gốc mới trên Google Drive
 * Chạy: npx ts-node scripts/create-drive-folder.ts
 */

import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  console.log("Đang tạo thư mục gốc trên Google Drive...");

  // Tạo folder gốc
  const folderRes = await drive.files.create({
    requestBody: {
      name: "KLTN_Files",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, name, webViewLink",
  });

  const folderId = folderRes.data.id!;
  const folderLink = folderRes.data.webViewLink!;

  // Share cho anyone có link có thể xem
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { role: "reader", type: "anyone" },
  });

  console.log("\n✅ Tạo thư mục thành công!");
  console.log(`   Tên  : KLTN_Files`);
  console.log(`   ID   : ${folderId}`);
  console.log(`   Link : ${folderLink}`);
  console.log("\n📋 Cập nhật vào .env.local:");
  console.log(`   GOOGLE_DRIVE_FOLDER_ID=${folderId}`);
  console.log(`   GOOGLE_DRIVE_ROOT_FOLDER_ID=${folderId}`);
}

main().catch(console.error);
