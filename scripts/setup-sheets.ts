/**
 * SETUP SCRIPT - Khởi tạo Google Sheets
 *
 * Chạy lệnh:
 *   npx ts-node scripts/setup-sheets.ts
 *
 * Script này sẽ:
 * 1. Tạo tất cả các sheet tab cần thiết trong Spreadsheet
 * 2. Điền headers cho từng tab
 * 3. Chạy seed dữ liệu mẫu
 */

import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

const SHEET_HEADERS: Record<string, string[]> = {
  users: [
    "id", "email", "password_hash", "full_name", "system_role",
    "student_code", "phone", "department", "major", "is_active",
    "created_at", "updated_at",
  ],
  lecturer_quotas: [
    "id", "lecturer_id", "quota", "current_count",
    "academic_year", "semester", "batch", "created_at", "updated_at",
  ],
  topics: [
    "id", "student_id", "supervisor_id", "reviewer_id", "title", "field",
    "company_name", "topic_type", "academic_year", "semester", "batch",
    "summary", "current_status", "created_at", "updated_at",
  ],
  topic_status_histories: [
    "id", "topic_id", "old_status", "new_status", "note", "changed_by", "changed_at",
  ],
  files: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_dang_ky: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_bao_cao: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_khoa_luan: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_turnitin: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_bai_bao: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_chinh_sua: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_bien_ban: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_giai_trinh: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_xac_nhan: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_nhan_xet: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  files_khac: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at",
  ],
  committee_assignments: [
    "id", "topic_id", "committee_name", "secretary_id", "chair_id",
    "member_1_id", "member_2_id", "created_by", "created_at",
  ],
  scores: [
    "id", "topic_id", "scorer_id", "score_role", "score_value",
    "comment", "created_at", "updated_at",
  ],
  revisions: [
    "id", "topic_id", "requested_by", "request_note", "revised_file_id",
    "is_approved", "approved_by", "approved_at", "created_at", "updated_at",
  ],
  notifications: [
    "id", "user_id", "title", "content", "is_read", "created_at",
  ],
  audit_logs: [
    "id", "user_id", "action", "entity_type", "entity_id", "metadata_json", "created_at",
  ],
  academic_terms: [
    "id", "academic_year", "semester", "batch", "is_active", "created_at", "updated_at",
  ],
};

async function setupSheets() {
  console.log("🚀 Bắt đầu khởi tạo Google Sheets...\n");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Lấy danh sách sheet hiện có
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = spreadsheet.data.sheets?.map((s) => s.properties?.title) ?? [];

  console.log(`📋 Sheet hiện có: ${existingSheets.join(", ") || "Trống"}\n`);

  const requests: object[] = [];

  // Tạo các sheet chưa có
  for (const sheetName of Object.keys(SHEET_HEADERS)) {
    if (!existingSheets.includes(sheetName)) {
      requests.push({
        addSheet: {
          properties: { title: sheetName },
        },
      });
      console.log(`➕ Sẽ tạo sheet: "${sheetName}"`);
    } else {
      console.log(`✓  Sheet đã có: "${sheetName}"`);
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log(`\n✅ Đã tạo ${requests.length} sheet mới\n`);
  }

  // Ghi headers vào từng sheet
  console.log("📝 Ghi headers...\n");
  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
    console.log(`✅ "${sheetName}": ${headers.length} cột`);
  }

  console.log("\n🎉 Khởi tạo hoàn tất!");
  console.log("📌 Tiếp theo: chạy seed dữ liệu mẫu bằng lệnh: npm run seed");
}

setupSheets().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
