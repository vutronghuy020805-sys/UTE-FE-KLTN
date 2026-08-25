import type { KltnStatus, BcttStatus, ScoreRole, FileType, SystemRole, TopicType } from "@/types";

// ============================================================
// NHÃN TIẾNG VIỆT
// ============================================================

export const KLTN_STATUS_LABELS: Record<KltnStatus, string> = {
  MOI_DANG_KY: "Mới đăng ký",
  CHO_GVHD_DUYET: "Chờ GVHD xác nhận",
  GVHD_TU_CHOI: "GVHD từ chối",
  CHO_TRUONG_KHOA_DUYET: "Chờ Trưởng bộ môn duyệt",
  DANG_THUC_HIEN: "Đang thực hiện",
  DA_NOP_BAI: "Đã nộp bài",
  CHO_CHAM_HUONG_DAN: "GVHD đã upload bài",
  KHONG_DAT_HUONG_DAN: "GVHD đã chấm điểm: KHÔNG ĐẠT",
  DA_CHAM_HUONG_DAN: "GVHD đã chấm điểm: ĐẠT",
  CHO_CHAM_PHAN_BIEN: "Chờ chấm phản biện",
  KHONG_DAT_PHAN_BIEN: "GVPB đã chấm điểm: KHÔNG ĐẠT",
  DA_CHAM_PHAN_BIEN: "GVPB đã chấm điểm: ĐẠT",
  CHO_HOI_DONG: "Chờ bảo vệ",
  DANG_CHAM_HOI_DONG: "Hoàn tất bảo vệ",
  CAN_CHINH_SUA: "Hoàn tất bảo vệ",
  DA_NOP_BAN_CHINH_SUA: "Chờ duyệt",
  CHO_GVHD_XAC_NHAN: "Chờ duyệt",
  CHO_CHU_TICH_DUYET: "Chờ duyệt",
  CHO_THU_KY_XAC_NHAN: "Chờ duyệt",
  HOAN_TAT: "Hoàn tất",
};

export const BCTT_STATUS_LABELS: Record<BcttStatus, string> = {
  MOI_DANG_KY: "Mới đăng ký",
  CHO_GVHD_DUYET: "Chờ GVHD duyệt",
  CAN_CHINH_SUA: "Cần chỉnh sửa",
  DA_DUYET: "Đã duyệt",
  DANG_THUC_HIEN: "Đang thực hiện",
  DA_NOP_BAO_CAO: "Đã nộp báo cáo",
  HOAN_TAT: "Hoàn tất",
};

export const SCORE_ROLE_LABELS: Record<ScoreRole, string> = {
  SUPERVISOR: "Giảng viên hướng dẫn",
  REVIEWER: "Giảng viên phản biện",
  COMMITTEE_MEMBER: "Thành viên hội đồng",
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  DANG_KY: "Hồ sơ đăng ký",
  BAO_CAO: "Báo cáo thực tập",
  KHOA_LUAN: "Bài khóa luận",
  TURNITIN: "Kết quả Turnitin",
  BAI_BAO: "Bài báo khoa học",
  CHINH_SUA: "Bản chỉnh sửa",
  BIEN_BAN_HOI_DONG: "Biên bản Hội đồng",
  PHIEU_GIAI_TRINH: "Phiếu giải trình chỉnh sửa",
  XAC_NHAN: "Giấy xác nhận",
  NHAN_XET_HOI_DONG: "Nhận xét góp ý (Chủ tịch HĐ)",
  KHAC: "Khác",
};

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  ADMIN: "Quản trị viên",
  DEAN: "Trưởng bộ môn",
  STUDENT: "Sinh viên",
  LECTURER: "Giảng viên",
};

export const TOPIC_TYPE_LABELS: Record<TopicType, string> = {
  BCTT: "Báo cáo thực tập",
  KLTN: "Khóa luận tốt nghiệp",
};

// ============================================================
// MÀU BADGE THEO TRẠNG THÁI
// ============================================================

export const KLTN_STATUS_COLORS: Record<KltnStatus, string> = {
  MOI_DANG_KY: "bg-slate-100 text-slate-700",
  CHO_GVHD_DUYET: "bg-amber-100 text-amber-700",
  GVHD_TU_CHOI: "bg-red-100 text-red-700",
  CHO_TRUONG_KHOA_DUYET: "bg-amber-100 text-amber-700",
  DANG_THUC_HIEN: "bg-blue-100 text-blue-700",
  DA_NOP_BAI: "bg-indigo-100 text-indigo-700",
  CHO_CHAM_HUONG_DAN: "bg-amber-100 text-amber-700",
  KHONG_DAT_HUONG_DAN: "bg-red-100 text-red-700",
  DA_CHAM_HUONG_DAN: "bg-emerald-100 text-emerald-700",
  CHO_CHAM_PHAN_BIEN: "bg-amber-100 text-amber-700",
  KHONG_DAT_PHAN_BIEN: "bg-red-100 text-red-700",
  DA_CHAM_PHAN_BIEN: "bg-emerald-100 text-emerald-700",
  CHO_HOI_DONG: "bg-purple-100 text-purple-700",
  DANG_CHAM_HOI_DONG: "bg-purple-100 text-purple-700",
  CAN_CHINH_SUA: "bg-orange-100 text-orange-700",
  DA_NOP_BAN_CHINH_SUA: "bg-indigo-100 text-indigo-700",
  CHO_GVHD_XAC_NHAN: "bg-amber-100 text-amber-700",
  CHO_CHU_TICH_DUYET: "bg-purple-100 text-purple-700",
  CHO_THU_KY_XAC_NHAN: "bg-teal-100 text-teal-700",
  HOAN_TAT: "bg-green-100 text-green-700",
};

// ============================================================
// TÊN SHEET TABS
// ============================================================

export const SHEET_NAMES = {
  USERS: "users",
  LECTURER_QUOTAS: "lecturer_quotas",
  TOPICS: "topics",
  TOPIC_STATUS_HISTORIES: "topic_status_histories",
  FILES: "files",                               // legacy (fallback)
  FILES_DANG_KY: "files_dang_ky",
  FILES_BAO_CAO: "files_bao_cao",
  FILES_KHOA_LUAN: "files_khoa_luan",
  FILES_TURNITIN: "files_turnitin",
  FILES_BAI_BAO: "files_bai_bao",
  FILES_CHINH_SUA: "files_chinh_sua",
  FILES_BIEN_BAN: "files_bien_ban",
  FILES_GIAI_TRINH: "files_giai_trinh",
  FILES_XAC_NHAN: "files_xac_nhan",
  FILES_NHAN_XET: "files_nhan_xet",
  FILES_KHAC: "files_khac",
  COMMITTEES: "committees",
  COMMITTEE_ASSIGNMENTS: "committee_assignments",
  SCORES: "scores",
  REVISIONS: "revisions",
  NOTIFICATIONS: "notifications",
  AUDIT_LOGS: "audit_logs",
  ACADEMIC_TERMS: "academic_terms",
  DRIVE_FOLDERS: "drive_folders",
  BB_GVHD_UNG_DUNG: "BB GVHD - Đề tài ứng dụng",
  BB_GVHD_NGHIEN_CUU: "BB GVHD - Đề tài NC",
  BB_GVPB_UNG_DUNG: "BB GVPB - Đề tài ứng dụng",
  BB_GVPB_NGHIEN_CUU: "BB GVPB - Đề tài NC",
  BB_HD: "BB HĐ",
  FIELD_TOPICS: "Field",
  REVIEWER_PREASSIGNMENTS: "reviewer_preassignments",
  DEADLINE_REMINDERS: "deadline_reminders",
  SETTINGS: "settings",
} as const;

// Map file_type → sheet name
export const FILE_TYPE_SHEET: Record<string, string> = {
  DANG_KY:          SHEET_NAMES.FILES_DANG_KY,
  BAO_CAO:          SHEET_NAMES.FILES_BAO_CAO,
  KHOA_LUAN:        SHEET_NAMES.FILES_KHOA_LUAN,
  TURNITIN:         SHEET_NAMES.FILES_TURNITIN,
  BAI_BAO:          SHEET_NAMES.FILES_BAI_BAO,
  CHINH_SUA:        SHEET_NAMES.FILES_CHINH_SUA,
  BIEN_BAN_HOI_DONG: SHEET_NAMES.FILES_BIEN_BAN,
  PHIEU_GIAI_TRINH: SHEET_NAMES.FILES_GIAI_TRINH,
  XAC_NHAN:         SHEET_NAMES.FILES_XAC_NHAN,
  NHAN_XET_HOI_DONG: SHEET_NAMES.FILES_NHAN_XET,
  KHAC:             SHEET_NAMES.FILES_KHAC,
};

// ============================================================
// ĐIỂM NGƯỠNG
// ============================================================

export const PASSING_SCORE = 5;             // Ngưỡng điểm đạt BCTT
export const SUPERVISOR_MAX_SCORE = 70;     // Tổng tối đa GVHD/GVPB (7 tiêu chí × 10)
export const SUPERVISOR_PASSING_SCORE = 5;  // Ngưỡng đạt GVHD/GVPB (tổng >= 5)

// ============================================================
// TRỌNG SỐ TÍNH ĐIỂM TỔNG (tuỳ chỉnh)
// ============================================================
export const SCORE_WEIGHTS = {
  SUPERVISOR: 0.2,    // 20%
  REVIEWER: 0.2,      // 20%
  COMMITTEE: 0.6,     // 60% (trung bình các TV hội đồng, trừ thư ký)
};

export function calculateTotalScore(
  supervisorScore?: number,      // 0–10
  reviewerScore?: number,        // 0–10
  committeeScores: number[] = [] // mỗi phần tử 0–10
): number | null {
  if (supervisorScore === undefined || reviewerScore === undefined || committeeScores.length === 0) {
    return null;
  }
  const avgCommittee = committeeScores.reduce((a, b) => a + b, 0) / committeeScores.length;
  const total =
    supervisorScore * SCORE_WEIGHTS.SUPERVISOR +
    reviewerScore * SCORE_WEIGHTS.REVIEWER +
    avgCommittee * SCORE_WEIGHTS.COMMITTEE;
  return Math.round(total * 100) / 100;
}

// ============================================================
// CHẤM TIÊU CHÍ "THỜI GIAN THUYẾT TRÌNH" (HĐ)
// ============================================================
// Rubric: ≤10 → 0.5; ≤12 → 0.3; ≤14 → 0.1; >14 → 0
export function computeTimeScore(minutes: number | null | undefined): number | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes <= 10) return 0.5;
  if (minutes <= 12) return 0.3;
  if (minutes <= 14) return 0.1;
  return 0;
}

/** Heuristic nhận diện tiêu chí "Thời gian" trong rubric HĐ — match theo label. */
export function isTimeCriterionLabel(label: string | undefined): boolean {
  if (!label) return false;
  return label.toLowerCase().includes("thời gian");
}
