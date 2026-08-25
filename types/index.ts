// ============================================================
// TYPES - Hệ thống Quản lý KLTN
// ============================================================

// --- Vai trò hệ thống (dùng để đăng nhập / dashboard mặc định) ---
export type SystemRole = "ADMIN" | "DEAN" | "STUDENT" | "LECTURER";

// --- Loại đề tài ---
export type TopicType = "BCTT" | "KLTN";

// --- Phân loại đề tài KLTN ---
export type TopicCategory = "UNG_DUNG" | "NGHIEN_CUU";

// --- Trạng thái KLTN ---
export type KltnStatus =
  | "MOI_DANG_KY"
  | "CHO_GVHD_DUYET"
  | "GVHD_TU_CHOI"
  | "CHO_TRUONG_KHOA_DUYET"
  | "DANG_THUC_HIEN"
  | "DA_NOP_BAI"
  | "CHO_CHAM_HUONG_DAN"
  | "KHONG_DAT_HUONG_DAN"
  | "DA_CHAM_HUONG_DAN"
  | "CHO_CHAM_PHAN_BIEN"
  | "KHONG_DAT_PHAN_BIEN"
  | "DA_CHAM_PHAN_BIEN"
  | "CHO_HOI_DONG"
  | "DANG_CHAM_HOI_DONG"
  | "CAN_CHINH_SUA"
  | "DA_NOP_BAN_CHINH_SUA"
  | "CHO_GVHD_XAC_NHAN"
  | "CHO_CHU_TICH_DUYET"
  | "CHO_THU_KY_XAC_NHAN"
  | "HOAN_TAT";

// --- Trạng thái BCTT ---
export type BcttStatus =
  | "MOI_DANG_KY"
  | "CHO_GVHD_DUYET"
  | "CAN_CHINH_SUA"
  | "DA_DUYET"
  | "DANG_THUC_HIEN"
  | "DA_NOP_BAO_CAO"
  | "HOAN_TAT";

export type TopicStatus = KltnStatus | BcttStatus;

// --- Vai trò chấm điểm ---
export type ScoreRole = "SUPERVISOR" | "REVIEWER" | "COMMITTEE_MEMBER";

// --- Loại file ---
export type FileType =
  | "DANG_KY"
  | "BAO_CAO"
  | "KHOA_LUAN"
  | "TURNITIN"
  | "BAI_BAO"
  | "CHINH_SUA"
  | "BIEN_BAN_HOI_DONG"
  | "PHIEU_GIAI_TRINH"
  | "XAC_NHAN"
  | "NHAN_XET_HOI_DONG"
  | "KHAC";

// ============================================================
// ENTITIES (tương ứng với tab trong Google Sheets)
// ============================================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  system_role: SystemRole;
  student_code?: string;
  phone?: string;
  department?: string;
  major?: string;
  training_system?: string;  // CLC, REGULAR, ADVANCED, ...
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LecturerQuota {
  id: string;
  lecturer_id: string;
  quota: number;
  current_count: number;
  academic_year: string;
  semester: string;
  batch: string;
  department?: string;       // Ngành áp dụng (để trống = tất cả ngành)
  training_system?: string;  // Hệ đào tạo: CLC, REGULAR, ALL (để trống = tất cả)
  is_approved?: string;      // "true" | "false" — TBM duyệt mở slot đăng ký
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  student_id: string;
  supervisor_id?: string;
  reviewer_id?: string;
  title: string;
  field: string;
  department?: string;
  company_name?: string;
  topic_type: TopicType;
  topic_category?: TopicCategory; // Chỉ cho KLTN: "UNG_DUNG" | "NGHIEN_CUU"
  academic_year: string;
  semester: string;
  batch: string;
  summary?: string;
  current_status: TopicStatus;
  created_at: string;
  updated_at: string;
}

export interface TopicStatusHistory {
  id: string;
  topic_id: string;
  old_status: string;
  new_status: string;
  note?: string;
  changed_by: string;
  changed_at: string;
}

export interface UploadedFile {
  id: string;
  topic_id: string;
  uploaded_by: string;
  file_type: FileType;
  original_name: string;
  stored_name: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface CommitteeAssignment {
  id: string;
  topic_id: string;
  committee_name: string;
  secretary_id: string;
  chair_id?: string;
  member_1_id?: string;
  member_2_id?: string;
  member_3_id?: string;
  member_4_id?: string;
  member_5_id?: string;
  defense_date?: string;
  /** Buổi bảo vệ: "MORNING" (sáng) | "AFTERNOON" (chiều) | "" */
  defense_session?: string;
  defense_location?: string;
  created_by: string;
  created_at: string;
}

export interface Score {
  id: string;
  topic_id: string;
  scorer_id: string;
  score_role: ScoreRole;
  score_value: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface Revision {
  id: string;
  topic_id: string;
  requested_by: string;
  request_note: string;
  revised_file_id?: string;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  created_at: string;
}

export interface AcademicTerm {
  id: string;
  academic_year: string;
  semester: string;
  batch: string;
  is_active: boolean;
  bctt_deadline?: string;
  kltn_deadline?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// VIEW MODELS (dữ liệu đã join cho UI)
// ============================================================

export interface TopicWithDetails extends Topic {
  student?: Omit<User, "password_hash">;
  supervisor?: Omit<User, "password_hash">;
  reviewer?: Omit<User, "password_hash">;
  scores?: Score[];
  files?: UploadedFile[];
  committee?: CommitteeAssignment;
  revisions?: Revision[];
}

export interface ScoreSummary {
  supervisorScore?: number;
  reviewerScore?: number;
  committeeScores: { scorerId: string; scorerName: string; score: number }[];
  totalScore?: number; // Chỉ trả về cho TKHD
}

// ============================================================
// SESSION (NextAuth)
// ============================================================

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  system_role: SystemRole;
  student_code?: string;
  department?: string;
  major?: string;
}

// ============================================================
// FORM DATA
// ============================================================

export interface RegisterTopicFormData {
  title: string;
  field: string;
  department?: string;
  topic_type: TopicType;
  topic_category?: TopicCategory;
  supervisor_id: string;
  company_name?: string;
  summary?: string;
  academic_year?: string;
  semester?: string;
  batch?: string;
}

export interface SubmitScoreFormData {
  score_value: number;
  comment?: string;
}

export interface AssignCommitteeFormData {
  committee_name: string;
  secretary_id: string;
  chair_id?: string;
  member_1_id?: string;
  member_2_id?: string;
  member_3_id?: string;
  member_4_id?: string;
  member_5_id?: string;
  defense_date?: string;
  defense_location?: string;
}
