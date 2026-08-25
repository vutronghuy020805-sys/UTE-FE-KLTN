import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import { SHEET_NAMES } from "@/lib/constants";

const SPREADSHEET_ID = (process.env.GOOGLE_SHEET_ID ||
  process.env.GOOGLE_SPREADSHEET_ID)!;

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
];

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

// Pattern phát hiện notification có hiển thị điểm cụ thể
// Ví dụ "(7.2/10)", "(5/10)", "(2.5/10)" — KHÔNG match "Điểm Final: 7.5" (vì secretary biên bản)
const SCORE_PATTERN = /\(\s*\d+(?:\.\d+)?\s*\/\s*10\s*\)/;

// Title patterns của notification chấm điểm GVHD/GVPB cũ
const SCORE_TITLE_PATTERNS = [
  /^GVHD đã chấm điểm/i,
  /^GVPB đã chấm điểm/i,
];

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.system_role?.toUpperCase();
  const isTbm = session.user.is_tbm === "true";
  const allowed = role === "DEAN" || role === "ADMIN" || (role === "LECTURER" && isTbm);
  if (!allowed) {
    return NextResponse.json({
      error: "Forbidden",
      debug: { role, isTbm, email: session.user.email },
    }, { status: 403 });
  }

  const sheets = getSheets();

  // Lấy sheetId của notifications
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAMES.NOTIFICATIONS,
  );
  if (!sheetMeta?.properties) {
    return NextResponse.json({ error: "Sheet notifications không tồn tại" }, { status: 500 });
  }
  const sheetId = sheetMeta.properties.sheetId!;

  // Đọc toàn bộ notifications
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAMES.NOTIFICATIONS,
  });
  const rows = resp.data.values ?? [];
  if (rows.length < 2) {
    return NextResponse.json({ deleted: 0, message: "Không có notification nào" });
  }

  const headers = rows[0] as string[];
  const titleIdx = headers.indexOf("title");
  const contentIdx = headers.indexOf("content");
  if (titleIdx === -1 || contentIdx === -1) {
    return NextResponse.json({ error: "Sheet notifications thiếu cột title/content" }, { status: 500 });
  }

  // Tìm các row index (1-indexed trong sheet, 0-indexed sau khi bỏ header) cần xóa
  const rowsToDelete: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const title = String(r[titleIdx] ?? "");
    const content = String(r[contentIdx] ?? "");

    const titleMatches = SCORE_TITLE_PATTERNS.some((p) => p.test(title));
    const contentHasScore = SCORE_PATTERN.test(content);

    if (titleMatches || contentHasScore) {
      rowsToDelete.push(i); // 0-indexed trong toàn bộ rows (đã có header), tức là rowIndex trong sheet
    }
  }

  if (rowsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0, message: "Không có notification nào chứa điểm" });
  }

  // Xóa từ dưới lên để không bị shift index
  rowsToDelete.sort((a, b) => b - a);

  // Gộp thành batchUpdate với nhiều deleteDimension
  const requests = rowsToDelete.map((rowIdx) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowIdx,
        endIndex: rowIdx + 1,
      },
    },
  }));

  // Vercel/sheets có giới hạn — chia batch nếu quá lớn
  const BATCH_SIZE = 100;
  let deleted = 0;
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: chunk },
    });
    deleted += chunk.length;
  }

  return NextResponse.json({
    deleted,
    total: rows.length - 1,
    message: `Đã xóa ${deleted}/${rows.length - 1} notification có chứa điểm`,
  });
}
