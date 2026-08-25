/**
 * SEED DATA - Dữ liệu mẫu cho Google Sheets
 * Chạy script này để điền dữ liệu vào spreadsheet.
 * 
 * Hướng dẫn chạy:
 * npx ts-node --project tsconfig.json lib/sheets/seed.ts
 * 
 * Hoặc tạo file script riêng.
 */

import { google } from "googleapis";


const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// ============================================================
// CẤU TRÚC HEADERS CHO TỪNG TAB
// ============================================================

export const SHEET_HEADERS: Record<string, string[]> = {
  users: [
    "id", "email", "password_hash", "full_name", "system_role",
    "student_code", "phone", "department", "major", "is_active",
    "created_at", "updated_at"
  ],
  lecturer_quotas: [
    "id", "lecturer_id", "quota", "current_count",
    "academic_year", "semester", "batch", "created_at", "updated_at"
  ],
  topics: [
    "id", "student_id", "supervisor_id", "reviewer_id", "title", "field",
    "company_name", "topic_type", "academic_year", "semester", "batch",
    "summary", "current_status", "created_at", "updated_at"
  ],
  topic_status_histories: [
    "id", "topic_id", "old_status", "new_status", "note", "changed_by", "changed_at"
  ],
  files: [
    "id", "topic_id", "uploaded_by", "file_type", "original_name",
    "stored_name", "file_url", "mime_type", "file_size", "uploaded_at"
  ],
  committee_assignments: [
    "id", "topic_id", "committee_name", "secretary_id", "chair_id",
    "member_1_id", "member_2_id", "created_by", "created_at"
  ],
  scores: [
    "id", "topic_id", "scorer_id", "score_role", "score_value",
    "comment", "created_at", "updated_at"
  ],
  revisions: [
    "id", "topic_id", "requested_by", "request_note", "revised_file_id",
    "is_approved", "approved_by", "approved_at", "created_at", "updated_at"
  ],
  notifications: [
    "id", "user_id", "title", "content", "is_read", "created_at"
  ],
  audit_logs: [
    "id", "user_id", "action", "entity_type", "entity_id", "metadata_json", "created_at"
  ],
  academic_terms: [
    "id", "academic_year", "semester", "batch", "is_active", "created_at", "updated_at"
  ],
};

// ============================================================
// DỮ LIỆU MẪU
// ============================================================

const now = new Date().toISOString();


export const SEED_DATA: Record<string, (string | number | boolean)[][]> = {
  users: [
    // Admin
    ["u_admin_01", "admin@kltn.edu.vn", "GOOGLE_AUTH", "Nguyễn Quản Trị", "ADMIN", "", "0901000001", "Công nghệ thông tin", "", true, now, now],
    // Trưởng khoa
    ["u_dean_01", "truongkhoa@kltn.edu.vn", "GOOGLE_AUTH", "Trần Văn Khoa", "DEAN", "", "0901000002", "Công nghệ thông tin", "", true, now, now],
    // Giảng viên 1 (có thể là GVHD, GVPB, TVHD)
    ["u_lec_01", "gvhd01@kltn.edu.vn", "GOOGLE_AUTH", "Lê Thị Hương", "LECTURER", "", "0901000003", "Công nghệ thông tin", "", true, now, now],
    // Giảng viên 2 (GVPB)
    ["u_lec_02", "gvpb01@kltn.edu.vn", "GOOGLE_AUTH", "Phạm Văn Minh", "LECTURER", "", "0901000004", "Công nghệ thông tin", "", true, now, now],
    // Giảng viên 3 (Thư ký hội đồng)
    ["u_lec_03", "tkhd01@kltn.edu.vn", "GOOGLE_AUTH", "Ngô Thị Lan", "LECTURER", "", "0901000005", "Công nghệ thông tin", "", true, now, now],
    // Giảng viên 4 (Thành viên hội đồng)
    ["u_lec_04", "tvhd01@kltn.edu.vn", "GOOGLE_AUTH", "Đặng Văn Dũng", "LECTURER", "", "0901000006", "Công nghệ thông tin", "", true, now, now],
    // Sinh viên 1 (có đề tài đang thực hiện)
    ["u_sv_01", "sv001@student.edu.vn", "GOOGLE_AUTH", "Nguyễn Văn An", "STUDENT", "SV001", "0901000007", "Công nghệ thông tin", "Khoa học máy tính", true, now, now],
    // Sinh viên 2 (mới đăng ký)
    ["u_sv_02", "sv002@student.edu.vn", "GOOGLE_AUTH", "Trần Thị Bình", "STUDENT", "SV002", "0901000008", "Công nghệ thông tin", "Khoa học máy tính", true, now, now],
    // Sinh viên 3 (đã hoàn tất)
    ["u_sv_03", "sv003@student.edu.vn", "GOOGLE_AUTH", "Lê Văn Cường", "STUDENT", "SV003", "0901000009", "Công nghệ thông tin", "Hệ thống thông tin", true, now, now],
  ],

  lecturer_quotas: [
    ["lq_01", "u_lec_01", 5, 2, "2024-2025", "1", "1", now, now],
    ["lq_02", "u_lec_02", 5, 1, "2024-2025", "1", "1", now, now],
    ["lq_03", "u_lec_03", 5, 0, "2024-2025", "1", "1", now, now],
    ["lq_04", "u_lec_04", 5, 0, "2024-2025", "1", "1", now, now],
  ],

  topics: [
    // KLTN sv_01 đang ở giai đoạn chấm GVHD
    [
      "t_001", "u_sv_01", "u_lec_01", "u_lec_02",
      "Xây dựng hệ thống quản lý sinh viên thực tập",
      "Công nghệ phần mềm", "Công ty TNHH ABC Tech", "KLTN",
      "2024-2025", "1", "1",
      "Hệ thống giúp quản lý toàn bộ quy trình thực tập của sinh viên",
      "CHO_CHAM_HUONG_DAN", now, now
    ],
    // KLTN sv_02 mới đăng ký, chờ GVHD
    [
      "t_002", "u_sv_02", "u_lec_01", "",
      "Ứng dụng AI trong phát hiện gian lận thi cử",
      "Trí tuệ nhân tạo", "", "KLTN",
      "2024-2025", "1", "1",
      "Nghiên cứu và áp dụng mô hình ML để phát hiện hành vi gian lận",
      "CHO_GVHD_DUYET", now, now
    ],
    // KLTN sv_03 đã hoàn tất
    [
      "t_003", "u_sv_03", "u_lec_01", "u_lec_02",
      "Phát triển chatbot hỗ trợ học tập",
      "Trí tuệ nhân tạo", "", "KLTN",
      "2024-2025", "1", "1",
      "Chatbot sử dụng NLP để trả lời câu hỏi học tập",
      "HOAN_TAT", now, now
    ],
  ],

  topic_status_histories: [
    ["tsh_001", "t_001", "", "MOI_DANG_KY", "Sinh viên đăng ký khóa luận", "u_sv_01", now],
    ["tsh_002", "t_001", "MOI_DANG_KY", "CHO_GVHD_DUYET", "Gửi yêu cầu GVHD", "u_sv_01", now],
    ["tsh_003", "t_001", "CHO_GVHD_DUYET", "CHO_TRUONG_KHOA_DUYET", "GVHD đồng ý hướng dẫn", "u_lec_01", now],
    ["tsh_004", "t_001", "CHO_TRUONG_KHOA_DUYET", "DANG_THUC_HIEN", "Trưởng khoa duyệt", "u_dean_01", now],
    ["tsh_005", "t_001", "DANG_THUC_HIEN", "DA_NOP_BAI", "Sinh viên nộp bài", "u_sv_01", now],
    ["tsh_006", "t_001", "DA_NOP_BAI", "CHO_CHAM_HUONG_DAN", "GVHD xác nhận nhận bài", "u_lec_01", now],
  ],

  committee_assignments: [
    ["ca_001", "t_003", "Hội đồng KLTN - Đợt 1/2025", "u_lec_03", "u_dean_01", "u_lec_04", "", "u_dean_01", now],
  ],

  scores: [
    // Điểm GVHD cho t_003 (đã hoàn tất)
    ["sc_001", "t_003", "u_lec_01", "SUPERVISOR", 8.5, "Sinh viên thực hiện tốt, đáp ứng yêu cầu đề tài", now, now],
    // Điểm GVPB cho t_003
    ["sc_002", "t_003", "u_lec_02", "REVIEWER", 7.5, "Bài làm khá, cần cải thiện phần đánh giá mô hình", now, now],
    // Điểm HĐ cho t_003
    ["sc_003", "t_003", "u_lec_04", "COMMITTEE_MEMBER", 8.0, "Trình bày rõ ràng, nắm vững kiến thức", now, now],
  ],

  notifications: [
    ["n_001", "u_sv_01", "Hồ sơ đang chờ chấm điểm", "Giảng viên hướng dẫn đang xem xét bài khóa luận của bạn.", false, now],
    ["n_002", "u_lec_01", "Sinh viên chờ xác nhận hướng dẫn", "Trần Thị Bình đã gửi yêu cầu đăng ký KLTN với bạn làm giảng viên hướng dẫn.", false, now],
  ],

  academic_terms: [
    ["at_001", "2024-2025", "1", "1", true, now, now],
    ["at_002", "2024-2025", "2", "1", false, now, now],
  ],

  audit_logs: [
    ["al_001", "u_admin_01", "SEED_DATA", "system", "all", '{"note":"Initial seed"}', now],
  ],

  files: [],
  revisions: [],
};

// ============================================================
// HÀM CHẠY SEED
// ============================================================

export async function runSeed() {
  console.log("🌱 Bắt đầu seed dữ liệu vào Google Sheets...");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    const rows = SEED_DATA[sheetName] ?? [];

    // Ghi headers + data
    const values = [headers, ...rows.map((row) => row.map(String))];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log(`✅ Sheet "${sheetName}": ${rows.length} hàng`);
  }

  console.log("🎉 Seed hoàn tất!");
  console.log("\n📋 TÀI KHOẢN DEMO:");
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│ Vai trò          │ Email                   │ Mật khẩu  │");
  console.log("├─────────────────────────────────────────────────────────┤");
  console.log("│ Admin            │ admin@kltn.edu.vn       │ Admin@123 │");
  console.log("│ Trưởng khoa      │ truongkhoa@kltn.edu.vn  │ Dean@123  │");
  console.log("│ GVHD             │ gvhd01@kltn.edu.vn      │ Gvhd@123  │");
  console.log("│ GVPB             │ gvpb01@kltn.edu.vn      │ Gvpb@123  │");
  console.log("│ Thư ký HĐ        │ tkhd01@kltn.edu.vn      │ Tkhd@123  │");
  console.log("│ TV Hội đồng      │ tvhd01@kltn.edu.vn      │ Tvhd@123  │");
  console.log("│ Sinh viên 1      │ sv001@student.edu.vn    │ Sv@123    │");
  console.log("│ Sinh viên 2      │ sv002@student.edu.vn    │ Sv@123    │");
  console.log("│ Sinh viên 3      │ sv003@student.edu.vn    │ Sv@123    │");
  console.log("└─────────────────────────────────────────────────────────┘");
}

/**
 * QUAN TRỌNG: Khi dùng Google OAuth
 * - Thay email trong SEED_DATA bằng Gmail thật của từng người
 * - Ví dụ: "sv001@student.edu.vn" → "nguyenvanan@gmail.com"
 * - Hệ thống sẽ khớp email Google với cột `email` trong sheet
 * - Cột `password_hash` giữ nguyên "GOOGLE_AUTH" (không dùng)
 */
