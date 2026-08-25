/**
 * CLEANUP SCRIPT — Xóa notification cũ leak điểm thành phần
 *
 * Notification cũ có nội dung kiểu "(5/10)", "(8.5/10)"... được tạo
 * trước khi commit bc60dab fix ẩn điểm. Script này quét tab
 * `notifications` và xóa các row khớp pattern điểm.
 *
 * Chạy:
 *   npx ts-node scripts/cleanup-old-score-notifications.ts          (dry-run)
 *   npx ts-node scripts/cleanup-old-score-notifications.ts --apply  (xóa thật)
 *
 * KHÔNG xóa notification "Điểm Final: X.XX" (do thư ký gửi biên bản —
 * pattern khác, không có '/10').
 */

import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET_NAME = "notifications";

// Pattern: (5/10), (8.5/10), (10/10), v.v.
const SCORE_PATTERN = /\(\d+(\.\d+)?\/10\)/;

async function main() {
  const apply = process.argv.includes("--apply");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`📋 Đọc tab "${SHEET_NAME}"...`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME,
  });

  const rows = res.data.values ?? [];
  if (rows.length < 2) {
    console.log("⚠ Không có dữ liệu.");
    return;
  }

  const headers = rows[0] as string[];
  const idIdx = headers.indexOf("id");
  const contentIdx = headers.indexOf("content");
  if (idIdx < 0 || contentIdx < 0) {
    console.error("❌ Không tìm thấy cột 'id' hoặc 'content' trong headers:", headers);
    process.exit(1);
  }

  // Tìm row khớp pattern
  const matches: { rowNumber: number; id: string; content: string }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const content = String(row[contentIdx] ?? "");
    if (SCORE_PATTERN.test(content)) {
      matches.push({
        rowNumber: i + 1, // sheets row number (1-based)
        id: String(row[idIdx] ?? ""),
        content,
      });
    }
  }

  console.log(`🔍 Tìm thấy ${matches.length} notification cũ có điểm:\n`);
  for (const m of matches.slice(0, 20)) {
    console.log(`  row ${m.rowNumber} (id=${m.id}): ${m.content.slice(0, 100)}`);
  }
  if (matches.length > 20) console.log(`  … và ${matches.length - 20} dòng khác`);

  if (matches.length === 0) {
    console.log("\n✅ Không có notification cũ nào cần xóa.");
    return;
  }

  if (!apply) {
    console.log(`\n🟡 DRY-RUN. Chạy lại với --apply để xóa thật.`);
    return;
  }

  // Lấy sheetId của tab notifications để dùng batchUpdate deleteDimension
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  const sheetId = tab?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    console.error(`❌ Không tìm thấy sheetId cho tab "${SHEET_NAME}"`);
    process.exit(1);
  }

  // Xóa từ dưới lên để row index không bị lệch
  const sortedDesc = [...matches].sort((a, b) => b.rowNumber - a.rowNumber);

  // Batch delete (1 API call)
  const requests = sortedDesc.map((m) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: m.rowNumber - 1, // 0-based
        endIndex: m.rowNumber,
      },
    },
  }));

  console.log(`\n🗑 Đang xóa ${matches.length} dòng...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log(`✅ Đã xóa ${matches.length} notification cũ.`);
}

main().catch((e) => {
  console.error("❌ Lỗi:", e);
  process.exit(1);
});
