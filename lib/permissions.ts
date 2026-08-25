import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { PASSING_SCORE } from "@/lib/constants";
import type { SystemRole } from "@/types";

// ============================================================
// LẤY SESSION HIỆN TẠI
// ============================================================

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.");
  return user;
}

// ============================================================
// KIỂM TRA QUYỀN HỆ THỐNG (system-level)
// ============================================================

export async function requireRole(allowedRoles: SystemRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.system_role)) {
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
  }
  return user;
}

export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function requireDean() {
  return requireRole(["DEAN", "ADMIN"]);
}

/** Kiểm tra user có phải TBM/Dean */
export function isTBMUser(user: { system_role: string }) {
  return ["DEAN", "ADMIN"].includes(user.system_role);
}

/**
 * Lấy ngành của TBM để filter dữ liệu theo major.
 * - ADMIN: trả về null (xem tất cả)
 * - DEAN: trả về major (nếu có), fallback department
 * - Role khác: trả về null
 */
export async function getDeanScopeMajor(): Promise<string | null> {
  const user = await requireAuth();
  if (user.system_role === "ADMIN") return null;
  if (user.system_role !== "DEAN") return null;
  const major = user.major || user.department || "";
  return major.trim() || null;
}

/**
 * Lọc danh sách topic theo major của TBM hiện tại (dựa vào student.major).
 * ADMIN hoặc TBM không có major → trả về nguyên danh sách.
 */
export async function filterTopicsByDeanMajor<T extends { student_id?: string }>(
  topics: T[],
): Promise<T[]> {
  const scopeMajor = await getDeanScopeMajor();
  if (!scopeMajor) return topics;

  const allUsers = (await db.users.getAll()) as Record<string, string>[];
  const userMajorMap = new Map(
    allUsers.map((u) => [u.id, (u.major || u.department || "").trim()]),
  );

  return topics.filter((t) => {
    if (!t.student_id) return false;
    const studentMajor = userMajorMap.get(t.student_id) ?? "";
    return studentMajor === scopeMajor;
  });
}

export async function requireLecturer() {
  return requireRole(["LECTURER", "DEAN", "ADMIN"]);
}

// ============================================================
// KIỂM TRA QUYỀN NGHIỆP VỤ (context-based, per-topic)
// Đây là phần quan trọng nhất — phân quyền theo đề tài cụ thể
// ============================================================

/**
 * Kiểm tra user có phải là GVHD của đề tài này không.
 */
export async function isTopicSupervisor(topicId: string, userId: string): Promise<boolean> {
  const topic = await db.topics.findById(topicId);
  return topic?.supervisor_id === userId;
}

/**
 * Kiểm tra user có phải là GVPB của đề tài này không.
 * QUAN TRỌNG: Cũng phải kiểm tra điểm GVHD > ngưỡng.
 */
export async function isTopicReviewer(topicId: string, userId: string): Promise<boolean> {
  const topic = await db.topics.findById(topicId);
  // GVPB được phép truy cập ngay khi được phân công, không cần chờ GVHD chấm điểm
  return topic?.reviewer_id === userId;
}

/**
 * Kiểm tra user có phải là thành viên hội đồng của đề tài này không.
 * QUAN TRỌNG: Cả GVHD và GVPB phải đã chấm > ngưỡng.
 */
export async function isTopicCouncilMember(topicId: string, userId: string): Promise<boolean> {
  const committee = await db.committees.findByTopic(topicId);
  if (!committee) return false;

  const isInCommittee = [
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
    committee.chair_id,
  ].includes(userId);

  if (!isInCommittee) return false;

  // Phải đã qua cả GVHD và GVPB
  return await bothScoresPassed(topicId);
}

/**
 * Kiểm tra user có phải là thư ký hội đồng của đề tài này không.
 */
export async function isTopicSecretary(topicId: string, userId: string): Promise<boolean> {
  const committee = await db.committees.findByTopic(topicId);
  return committee?.secretary_id === userId;
}

/**
 * Kiểm tra user có phải là sinh viên của đề tài này không.
 */
export async function isTopicStudent(topicId: string, userId: string): Promise<boolean> {
  const topic = await db.topics.findById(topicId);
  return topic?.student_id === userId;
}

// ============================================================
// HELPERS
// ============================================================

async function bothScoresPassed(topicId: string): Promise<boolean> {
  const scores = await db.scores.filter({ topic_id: topicId });

  const supervisorScore = scores.find((s) => s.score_role === "SUPERVISOR");
  const reviewerScore = scores.find((s) => s.score_role === "REVIEWER");

  // Cả GVHD và GVPB: chỉ cần đã chấm, không yêu cầu điểm tối thiểu
  return supervisorScore !== undefined && reviewerScore !== undefined;
}

// ============================================================
// SERVER ACTION GUARDS
// Dùng trong server actions để kiểm tra quyền trước khi xử lý
// ============================================================

export async function guardSupervisorAction(topicId: string) {
  const user = await requireAuth();
  if (user.system_role !== "LECTURER" && user.system_role !== "DEAN") {
    throw new Error("Không có quyền thực hiện thao tác này");
  }
  const ok = await isTopicSupervisor(topicId, user.id);
  if (!ok) throw new Error("Bạn không phải giảng viên hướng dẫn của đề tài này");
  return user;
}

export async function guardReviewerAction(topicId: string) {
  const user = await requireAuth();
  const ok = await isTopicReviewer(topicId, user.id);
  if (!ok) throw new Error("Bạn không có quyền phản biện đề tài này hoặc hồ sơ chưa đủ điều kiện");
  return user;
}

export async function guardCouncilAction(topicId: string) {
  const user = await requireAuth();
  const ok = await isTopicCouncilMember(topicId, user.id);
  if (!ok) throw new Error("Bạn không phải thành viên hội đồng của đề tài này");
  return user;
}

export async function guardSecretaryAction(topicId: string) {
  const user = await requireAuth();
  const ok = await isTopicSecretary(topicId, user.id);
  if (!ok) throw new Error("Bạn không phải thư ký hội đồng của đề tài này");
  return user;
}

export async function guardChairAction(topicId: string) {
  const user = await requireAuth();
  const committee = await db.committees.findByTopic(topicId);
  if (committee?.chair_id !== user.id) throw new Error("Bạn không phải chủ tịch hội đồng của đề tài này");
  return user;
}

export async function guardStudentAction(topicId: string) {
  const user = await requireAuth();
  if (user.system_role !== "STUDENT") throw new Error("Chỉ sinh viên mới có thể thực hiện thao tác này");
  const ok = await isTopicStudent(topicId, user.id);
  if (!ok) throw new Error("Đây không phải đề tài của bạn");
  return user;
}
