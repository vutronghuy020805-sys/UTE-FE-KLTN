import "server-only";

import { cache } from "react";
import { google, sheets_v4 } from "googleapis";
import { SHEET_NAMES, FILE_TYPE_SHEET } from "@/lib/constants";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

// FIX 1: Đọc cả GOOGLE_SHEET_ID lẫn GOOGLE_SPREADSHEET_ID
const SPREADSHEET_ID = (process.env.GOOGLE_SHEET_ID ||
  process.env.GOOGLE_SPREADSHEET_ID)!;

// ── Module-level cache: tồn tại suốt lifetime của process (shared giữa mọi request) ──
// TTL theo TIER — sheet tĩnh cache lâu để giảm Sheets API quota khi đông user.
const TTL = {
  STATIC: 30 * 60_000,  // 30 phút — gần như không đổi trong buổi bảo vệ
  SLOW:    5 * 60_000,  // 5 phút  — đổi vài lần / buổi
  MEDIUM:  60_000,      // 1 phút  — đổi thường xuyên hơn
  FAST:    20_000,      // 20 giây — đổi liên tục (scores trong lúc chấm)
};

function ttlForSheet(sheetName: string): number {
  // users — SLOW (5 phút) thay vì STATIC vì liên quan auth: khi admin xóa
  // email / disable user, cần phản ánh sớm, không thể chờ 30 phút.
  if (sheetName === "users") return TTL.SLOW;
  // Tĩnh nhất: terms, criteria templates — gần như không đổi
  if (sheetName === "academic_terms") return TTL.STATIC;
  if (sheetName.startsWith("BB ")) return TTL.STATIC;          // BB GVHD/GVPB criteria
  if (sheetName === "Field") return TTL.STATIC;
  if (sheetName === "drive_folders") return TTL.STATIC;
  if (sheetName === "reviewer_preassignments") return TTL.STATIC;
  if (sheetName === "lecturer_quotas") return TTL.STATIC;
  if (sheetName === "settings") return TTL.STATIC;

  // Đổi vài lần / buổi: topics, committees, files, deadlines
  if (sheetName === "topics") return TTL.SLOW;
  if (sheetName === "committees") return TTL.SLOW;
  if (sheetName === "committee_assignments") return TTL.SLOW;
  if (sheetName.startsWith("files_")) return TTL.SLOW;
  if (sheetName === "files") return TTL.SLOW;
  if (sheetName === "deadline_reminders") return TTL.SLOW;
  if (sheetName === "topic_status_histories") return TTL.SLOW;
  if (sheetName === "revisions") return TTL.SLOW;

  // Đổi liên tục lúc chấm — cần fresh
  if (sheetName === "scores") return TTL.FAST;
  if (sheetName === "notifications") return TTL.MEDIUM;
  if (sheetName === "audit_logs") return TTL.MEDIUM;

  return TTL.MEDIUM; // default
}

interface CacheEntry {
  data: string[][];
  expiresAt: number;
}

const moduleCache = new Map<string, CacheEntry>();
// Giữ promise đang chạy để không gọi API 2 lần cùng lúc (thundering herd)
const inflight = new Map<string, Promise<string[][]>>();

function moduleInvalidate(sheetName: string) {
  moduleCache.delete(sheetName);
}

/** Public API — force invalidate sheet cache (dùng khi cần đảm bảo đọc fresh sau write) */
export function invalidateSheetCache(sheetName: string) {
  moduleInvalidate(sheetName);
}

async function fetchFromApi(sheetName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  return (response.data.values as string[][] | null) ?? [];
}

/**
 * Fetch raw từ Sheets API.
 * 1. Module-level cache (TTL tier theo sheet — xem ttlForSheet) — dùng chung giữa mọi request/user
 * 2. React cache() — dedup trong cùng một render cycle
 */
const fetchSheetRaw = cache(async (sheetName: string): Promise<string[][]> => {
  // Kiểm tra module cache
  const entry = moduleCache.get(sheetName);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }

  // Nếu đang có request khác fetch cùng sheet → chờ chung
  const existing = inflight.get(sheetName);
  if (existing) return existing;

  const promise = fetchFromApi(sheetName).then((data) => {
    moduleCache.set(sheetName, { data, expiresAt: Date.now() + ttlForSheet(sheetName) });
    inflight.delete(sheetName);
    return data;
  }).catch((err) => {
    inflight.delete(sheetName);
    throw err;
  });

  inflight.set(sheetName, promise);
  return promise;
});

/**
 * Đọc sheet tiêu chí chấm điểm theo index cột (tránh lỗi encoding tên cột)
 * Cột 0 = Tên TC, Cột 1 = Điểm tối đa
 */
export interface RubricLevel { range: string; desc: string }
export interface CriteriaRow {
  label: string;
  maxScore: number;
  rubric?: { yeu: RubricLevel; trung_binh: RubricLevel; kha: RubricLevel; gioi: RubricLevel };
}

function parseRubricCell(cell: string | undefined): RubricLevel | null {
  if (!cell?.trim()) return null;
  const idx = cell.indexOf("|");
  if (idx === -1) return { range: "", desc: cell.trim() };
  return { range: cell.slice(0, idx).trim(), desc: cell.slice(idx + 1).trim() };
}

export async function fetchCriteriaSheet(sheetName: string): Promise<CriteriaRow[]> {
  const rows = await fetchSheetRaw(sheetName);
  if (rows.length < 2) return [];
  return rows.slice(1)
    .filter((row) => row[0]?.trim())
    .map((row) => {
      const parsed = Number(String(row[1] ?? "").replace(",", "."));
      const yeu = parseRubricCell(row[2]);
      const trung_binh = parseRubricCell(row[3]);
      const kha = parseRubricCell(row[4]);
      const gioi = parseRubricCell(row[5]);
      const hasRubric = yeu && trung_binh && kha && gioi;
      return {
        label: row[0].trim(),
        maxScore: parsed > 0 ? parsed : 10,
        ...(hasRubric ? { rubric: { yeu, trung_binh, kha, gioi } } : {}),
      };
    });
}

export async function sheetGetAll<T extends Record<string, string>>(
  sheetName: string,
): Promise<T[]> {
  const rows = await fetchSheetRaw(sheetName);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj as T;
  });
}

export async function sheetFindOne<T extends Record<string, string>>(
  sheetName: string,
  predicate: (item: T) => boolean,
): Promise<T | null> {
  const all = await sheetGetAll<T>(sheetName);
  return all.find(predicate) ?? null;
}

function a1Column(index: number): string {
  let s = "";
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Đảm bảo sheet có cột `columnName` ở header; nếu thiếu thì tự append. */
export async function ensureSheetColumn(sheetName: string, columnName: string): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = (response.data.values?.[0] as string[] | undefined) ?? [];
  if (headers.includes(columnName)) return;
  const colLetter = a1Column(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${colLetter}1`,
    valueInputOption: "RAW",
    requestBody: { values: [[columnName]] },
  });
  moduleInvalidate(sheetName);
}

export async function sheetAppend(
  sheetName: string,
  data: Record<string, string | number | boolean>,
): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = response.data.values?.[0] as string[] | undefined;
  if (!headers) throw new Error(`Sheet "${sheetName}" chưa có headers`);

  const row = headers.map((h) => String(data[h] ?? ""));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
  moduleInvalidate(sheetName);
}

/**
 * Append nhiều rows cùng lúc vào 1 sheet — chỉ 2 API calls bất kể số lượng rows.
 * Dùng cho bulk import để tránh timeout.
 */
export async function sheetAppendMany(
  sheetName: string,
  dataArray: Record<string, string | number | boolean>[],
): Promise<void> {
  if (dataArray.length === 0) return;
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = response.data.values?.[0] as string[] | undefined;
  if (!headers) throw new Error(`Sheet "${sheetName}" chưa có headers`);

  const values = dataArray.map((data) => headers.map((h) => String(data[h] ?? "")));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
  moduleInvalidate(sheetName);
}

export async function sheetUpdate(
  sheetName: string,
  id: string,
  updates: Record<string, string | number | boolean>,
): Promise<void> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return;

  const headers = rows[0] as string[];
  const idIndex = headers.indexOf("id");
  if (idIndex === -1) throw new Error(`Sheet "${sheetName}" không có cột id`);

  const rowIndex = rows.findIndex((row, i) => i > 0 && row[idIndex] === id);
  if (rowIndex === -1)
    throw new Error(`Không tìm thấy id="${id}" trong sheet "${sheetName}"`);

  const updatedRow = [...rows[rowIndex]];
  Object.entries(updates).forEach(([key, value]) => {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) updatedRow[colIndex] = String(value);
  });

  const sheetRowNumber = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [updatedRow] },
  });
  moduleInvalidate(sheetName);
}

// Cập nhật nhiều dòng đã tồn tại: 1 read + 1 batchUpdate (an toàn, không ghi đè toàn sheet)
export async function sheetBatchRangeUpdate(
  sheetName: string,
  updates: Array<{ id: string; data: Record<string, string> }>,
): Promise<void> {
  if (updates.length === 0) return;
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = (response.data.values as string[][] | undefined) ?? [];
  if (rows.length < 2) return;

  const headers = rows[0];
  const idIndex = headers.indexOf("id");
  if (idIndex === -1) throw new Error(`Sheet "${sheetName}" không có cột id`);

  const dataRanges: { range: string; values: string[][] }[] = [];
  for (const { id, data } of updates) {
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idIndex] === id);
    if (rowIndex === -1) continue;
    const updatedRow = [...rows[rowIndex]];
    Object.entries(data).forEach(([key, val]) => {
      const col = headers.indexOf(key);
      if (col !== -1) updatedRow[col] = val;
    });
    rows[rowIndex] = updatedRow; // cập nhật trong memory để tránh ghi đè lẫn nhau
    dataRanges.push({ range: `${sheetName}!A${rowIndex + 1}`, values: [updatedRow] });
  }

  if (dataRanges.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data: dataRanges },
  });
  moduleInvalidate(sheetName);
}

// Upsert nhiều dòng cùng lúc: chỉ 1 read + tối đa 2 writes, bất kể số dòng
export async function sheetBatchUpsert(
  sheetName: string,
  rows: Array<{ existingId?: string; data: Record<string, string> }>,
): Promise<void> {
  if (rows.length === 0) return;
  const sheets = getSheetsClient();

  // 1 read duy nhất
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const existingRows: string[][] = (response.data.values as string[][] | undefined) ?? [[]];
  const headers = existingRows[0] ?? [];
  if (headers.length === 0) throw new Error(`Sheet "${sheetName}" chưa có headers`);
  const idIndex = headers.indexOf("id");

  const updatedRows = existingRows.map((r) => [...r]);
  const newRows: string[][] = [];

  for (const { existingId, data } of rows) {
    if (existingId && idIndex !== -1) {
      const rowIdx = updatedRows.findIndex((r, i) => i > 0 && r[idIndex] === existingId);
      if (rowIdx !== -1) {
        Object.entries(data).forEach(([key, val]) => {
          const col = headers.indexOf(key);
          if (col !== -1) updatedRows[rowIdx][col] = val;
        });
        continue;
      }
    }
    newRows.push(headers.map((h) => data[h] ?? ""));
  }

  // 1 write cho các dòng cập nhật
  if (updatedRows.length > 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: updatedRows },
    });
  }
  // 1 write cho các dòng mới (nếu có)
  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newRows },
    });
  }
  moduleInvalidate(sheetName);
}

export async function sheetFilter<T extends Record<string, string>>(
  sheetName: string,
  filters: Partial<Record<keyof T, string>>,
): Promise<T[]> {
  const all = await sheetGetAll<T>(sheetName);
  return all.filter((item) =>
    Object.entries(filters).every(
      ([key, value]) => item[key as keyof T] === value,
    ),
  );
}

export async function sheetDeleteRow(
  sheetName: string,
  id: string,
): Promise<void> {
  const sheets = getSheetsClient();

  // Lấy sheetId từ metadata
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName,
  );
  if (!sheetMeta?.properties?.sheetId === undefined)
    throw new Error(`Sheet "${sheetName}" không tìm thấy`);
  const sheetId = sheetMeta!.properties!.sheetId!;

  // Tìm số thứ tự hàng (0-indexed)
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = resp.data.values;
  if (!rows || rows.length < 2) return;
  const headers = rows[0] as string[];
  const idIndex = headers.indexOf("id");
  if (idIndex === -1) throw new Error(`Sheet "${sheetName}" không có cột id`);
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[idIndex] === id);
  if (rowIndex === -1) return; // Không tìm thấy → bỏ qua

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
  moduleInvalidate(sheetName);
}

export const db = {
  users: {
    getAll: () => sheetGetAll(SHEET_NAMES.USERS),
    findById: (id: string) =>
      sheetFindOne(SHEET_NAMES.USERS, (u) => u.id === id),
    findByEmail: (email: string) =>
      sheetFindOne(
        SHEET_NAMES.USERS,
        (u) => u.email?.trim().toLowerCase() === email.trim().toLowerCase(),
      ),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.USERS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.USERS, id, data),
    // FIX 2: filter is_active không phân biệt hoa/thường
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.USERS, filters).then((users) =>
        filters.system_role
          ? users.filter(
              (u) =>
                u.system_role?.toUpperCase() ===
                filters.system_role?.toUpperCase(),
            )
          : users,
      ),
  },
  topics: {
    getAll: () => sheetGetAll(SHEET_NAMES.TOPICS),
    findById: (id: string) =>
      sheetFindOne(SHEET_NAMES.TOPICS, (t) => t.id === id),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.TOPICS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.TOPICS, id, data),
    delete: (id: string) => sheetDeleteRow(SHEET_NAMES.TOPICS, id),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.TOPICS, filters),
  },
  scores: {
    getAll: () => sheetGetAll(SHEET_NAMES.SCORES),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.SCORES, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.SCORES, id, data),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.SCORES, filters),
  },
  statusHistories: {
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.TOPIC_STATUS_HISTORIES, data),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.TOPIC_STATUS_HISTORIES, filters),
  },
  files: {
    getAll: async () => {
      // Lấy từ tất cả các sheet theo file_type, gộp lại
      const allSheets = Object.values(FILE_TYPE_SHEET);
      const results = await Promise.all(allSheets.map((s) => sheetGetAll(s).catch(() => [])));
      return results.flat();
    },
    create: (data: Record<string, string | number | boolean>) => {
      const fileType = data.file_type as string;
      const sheet = FILE_TYPE_SHEET[fileType] ?? SHEET_NAMES.FILES_KHAC;
      return sheetAppend(sheet, data);
    },
    filter: async (filters: Record<string, string>) => {
      const fileType = filters.file_type;
      if (fileType && FILE_TYPE_SHEET[fileType]) {
        // Truy vấn thẳng vào sheet của file_type đó
        return sheetFilter(FILE_TYPE_SHEET[fileType], filters);
      }
      // Không có file_type → tìm trên tất cả các sheet
      const allSheets = Object.values(FILE_TYPE_SHEET);
      const results = await Promise.all(
        allSheets.map((s) => sheetFilter(s, filters).catch(() => []))
      );
      return results.flat();
    },
    delete: async (id: string, fileType?: string) => {
      // Nếu biết file_type → xóa thẳng trên sheet đó. Không thì duyệt tất cả.
      if (fileType && FILE_TYPE_SHEET[fileType]) {
        return sheetDeleteRow(FILE_TYPE_SHEET[fileType], id);
      }
      const allSheets = Object.values(FILE_TYPE_SHEET);
      for (const s of allSheets) {
        try { await sheetDeleteRow(s, id); return; } catch { /* not in this sheet */ }
      }
    },
  },
  committees: {
    getAll: () => sheetGetAll(SHEET_NAMES.COMMITTEES),
    findById: (id: string) =>
      sheetFindOne(SHEET_NAMES.COMMITTEES, (c) => c.id === id),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.COMMITTEES, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.COMMITTEES, id, data),
    delete: (id: string) => sheetDeleteRow(SHEET_NAMES.COMMITTEES, id),
    // Join committees + committee_assignments → trả về committee kèm topic_id (backward compat)
    findByTopic: async (topicId: string): Promise<Record<string, string> | null> => {
      const assignment = await sheetFindOne(
        SHEET_NAMES.COMMITTEE_ASSIGNMENTS,
        (a) => a.topic_id === topicId,
      );
      if (!assignment) return null;
      const committee = await sheetFindOne(
        SHEET_NAMES.COMMITTEES,
        (c) => c.id === assignment.committee_id,
      );
      if (!committee) return null;
      return { ...committee, topic_id: topicId };
    },
    // Trả về mảng { ...committeeFields, topic_id } — dùng cho list pages
    // Sort theo (committee_id, order_index) để giữ đúng thứ tự thuyết trình
    // mà TBM đã sắp xếp.
    getAllWithTopics: async () => {
      const [committees, assignments] = await Promise.all([
        sheetGetAll(SHEET_NAMES.COMMITTEES),
        sheetGetAll(SHEET_NAMES.COMMITTEE_ASSIGNMENTS).catch(() => [] as Record<string, string>[]),
      ]);
      const committeeMap = new Map(committees.map((c) => [c.id, c]));
      const orderNum = (a: Record<string, string>) => {
        const n = parseInt(a.order_index ?? "", 10);
        return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
      };
      const sorted = [...assignments].sort((a, b) => {
        if (a.committee_id !== b.committee_id)
          return (a.committee_id ?? "").localeCompare(b.committee_id ?? "");
        const oa = orderNum(a);
        const ob = orderNum(b);
        if (oa !== ob) return oa - ob;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
      return sorted
        .map((a) => {
          const c = committeeMap.get(a.committee_id);
          return c ? { ...c, topic_id: a.topic_id, order_index: a.order_index ?? "" } : null;
        })
        .filter(Boolean) as Record<string, string>[];
    },
    // Lấy tất cả GV đã được phân công vào HĐ trong ngày (để filter)
    getMemberIdsByDate: async (date: string): Promise<Set<string>> => {
      const all = await sheetGetAll(SHEET_NAMES.COMMITTEES);
      const sameDay = all.filter((c) => c.defense_date?.startsWith(date));
      const ids = new Set<string>();
      sameDay.forEach((c) => {
        [c.chair_id, c.secretary_id, c.member_1_id, c.member_2_id, c.member_3_id, c.member_4_id, c.member_5_id]
          .filter(Boolean).forEach((id) => ids.add(id));
      });
      return ids;
    },
  },
  committeeTopics: {
    getAll: () => sheetGetAll(SHEET_NAMES.COMMITTEE_ASSIGNMENTS),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, filters),
    findByTopic: (topicId: string) =>
      sheetFindOne(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, (c) => c.topic_id === topicId),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, id, data),
    delete: (id: string) => sheetDeleteRow(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, id),
  },
  revisions: {
    getAll: () => sheetGetAll(SHEET_NAMES.REVISIONS),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.REVISIONS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.REVISIONS, id, data),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.REVISIONS, filters),
  },
  notifications: {
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.NOTIFICATIONS, data),
    filter: (filters: Record<string, string>) =>
      sheetFilter(SHEET_NAMES.NOTIFICATIONS, filters),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.NOTIFICATIONS, id, data),
  },
  auditLogs: {
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.AUDIT_LOGS, data),
    getAll: () => sheetGetAll(SHEET_NAMES.AUDIT_LOGS),
  },
  reminders: {
    getAll: () => sheetGetAll(SHEET_NAMES.DEADLINE_REMINDERS),
    findById: (id: string) =>
      sheetFindOne(SHEET_NAMES.DEADLINE_REMINDERS, (r) => r.id === id),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.DEADLINE_REMINDERS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.DEADLINE_REMINDERS, id, data),
    delete: (id: string) => sheetDeleteRow(SHEET_NAMES.DEADLINE_REMINDERS, id),
  },
  quotas: {
    getAll: () => sheetGetAll(SHEET_NAMES.LECTURER_QUOTAS),
    findByLecturer: (
      lecturerId: string,
      academicYear: string,
      semester: string,
      trainingSystem?: string,
    ) =>
      sheetGetAll(SHEET_NAMES.LECTURER_QUOTAS).then((all) => {
        const matching = all.filter(
          (q) =>
            q.lecturer_id === lecturerId &&
            q.academic_year === academicYear &&
            q.semester === semester,
        );
        if (!trainingSystem || trainingSystem === "") {
          // Ưu tiên record không có training_system (quota chung)
          return matching.find((q) => !q.training_system || q.training_system === "" || q.training_system === "ALL") ?? matching[0] ?? null;
        }
        // Tìm quota khớp đúng training_system, nếu không có thì dùng quota ALL
        return (
          matching.find((q) => q.training_system === trainingSystem) ??
          matching.find((q) => !q.training_system || q.training_system === "" || q.training_system === "ALL") ??
          null
        );
      }),
    findAllByLecturer: (
      lecturerId: string,
      academicYear: string,
      semester: string,
    ) =>
      sheetFilter(SHEET_NAMES.LECTURER_QUOTAS, {
        lecturer_id: lecturerId,
        academic_year: academicYear,
        semester: semester,
      }),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.LECTURER_QUOTAS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.LECTURER_QUOTAS, id, data),
  },
  fieldTopics: {
    getAll: () => sheetGetAll(SHEET_NAMES.FIELD_TOPICS),
  },
  reviewerPreassignments: {
    getAll: () => sheetGetAll(SHEET_NAMES.REVIEWER_PREASSIGNMENTS),
    findByStudent: (studentId: string, academicYear: string, semester: string) =>
      sheetGetAll(SHEET_NAMES.REVIEWER_PREASSIGNMENTS).then((all) =>
        all.find(
          (r) =>
            (r.student_id === studentId) &&
            r.academic_year === academicYear &&
            r.semester === semester,
        ) ?? null,
      ),
    // Tra cứu theo email sinh viên (dùng khi đăng nhập bằng email)
    findByStudentEmail: (email: string, academicYear: string, semester: string) =>
      sheetGetAll(SHEET_NAMES.REVIEWER_PREASSIGNMENTS).then((all) =>
        all.find(
          (r) =>
            r.student_email?.toLowerCase() === email.toLowerCase() &&
            r.academic_year === academicYear &&
            r.semester === semester,
        ) ?? null,
      ),
    create: (data: Record<string, string>) => sheetAppend(SHEET_NAMES.REVIEWER_PREASSIGNMENTS, data),
    update: (id: string, data: Record<string, string>) =>
      sheetUpdate(SHEET_NAMES.REVIEWER_PREASSIGNMENTS, id, data),
  },
  settings: {
    getAll: async (): Promise<Record<string, string>> => {
      const rows = await sheetGetAll<{ key: string; value: string }>(SHEET_NAMES.SETTINGS).catch(() => []);
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
    set: async (key: string, value: string): Promise<void> => {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_NAMES.SETTINGS,
      });
      const rows = (res.data.values as string[][] | null) ?? [];
      if (rows.length < 1) return;
      const headers = rows[0];
      const keyIdx = headers.indexOf("key");
      const valIdx = headers.indexOf("value");
      if (keyIdx === -1 || valIdx === -1) return;
      const rowIdx = rows.findIndex((r, i) => i > 0 && r[keyIdx] === key);
      if (rowIdx === -1) {
        const newRow = headers.map((h) => (h === "key" ? key : h === "value" ? value : ""));
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_NAMES.SETTINGS,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [newRow] },
        });
      } else {
        const updated = [...rows[rowIdx]];
        updated[valIdx] = value;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAMES.SETTINGS}!A${rowIdx + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [updated] },
        });
      }
      moduleInvalidate(SHEET_NAMES.SETTINGS);
    },
  },
  driveFolders: {
    getAll: () => sheetGetAll(SHEET_NAMES.DRIVE_FOLDERS),
    findByKey: (key: string) =>
      sheetFindOne(SHEET_NAMES.DRIVE_FOLDERS, (r) => r.key === key),
    save: (key: string, url: string, label: string) =>
      sheetAppend(SHEET_NAMES.DRIVE_FOLDERS, {
        key,
        url,
        label,
        created_at: new Date().toISOString(),
      }),
  },
  terms: {
    getAll: () => sheetGetAll(SHEET_NAMES.ACADEMIC_TERMS),
    getActive: () =>
      sheetFindOne(
        SHEET_NAMES.ACADEMIC_TERMS,
        (t) => t.Active?.toString().toUpperCase() === "YES" || t.is_active?.toString().toUpperCase() === "TRUE",
      ),
    // Lấy các đợt đang mở đăng ký theo ngành + loại đề tài
    getOpenForRegistration: (major: string, topicType: string) =>
      sheetGetAll(SHEET_NAMES.ACADEMIC_TERMS).then((all) => {
        const now = new Date();
        return all.filter((t) => {
          const isActive = t.Active?.toString().toUpperCase() === "YES";
          if (!isActive) return false;
          const matchesMajor = t.Major === major;
          const matchesType = t.Loaidetai === topicType;
          if (!matchesMajor || !matchesType) return false;
          // Kiểm tra thời gian đăng ký
          const start = t.StartReg ? new Date(t.StartReg) : null;
          const end = t.EndReg ? new Date(t.EndReg) : null;
          if (start && now < start) return false;
          if (end && now > end) return false;
          return true;
        });
      }),
    create: (data: Record<string, string | number | boolean>) =>
      sheetAppend(SHEET_NAMES.ACADEMIC_TERMS, data),
    update: (id: string, data: Record<string, string | number | boolean>) =>
      sheetUpdate(SHEET_NAMES.ACADEMIC_TERMS, id, data),
  },
};
