"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/sheets/client";
import {
  guardSupervisorAction,
  guardReviewerAction,
  guardCouncilAction,
  guardSecretaryAction,
  guardChairAction,
  guardStudentAction,
  requireAuth,
  requireDean,
} from "@/lib/permissions";
import { generateId, nowISO, ok, err, type ActionResult } from "@/lib/utils";
import { sheetBatchUpsert, sheetBatchRangeUpdate, sheetAppendMany, ensureSheetColumn, sheetDeleteRow, invalidateSheetCache } from "@/lib/sheets/client";
import { SHEET_NAMES } from "@/lib/constants";
import { isEmailConfigured, sendCommitteeAssignmentEmail, sendKltnFailedEmail, sendRevisionRejectedEmail, type CommitteeRoleLabel } from "@/lib/email";
import {
  writeAuditLog,
  sendNotification,
  recordStatusChange,
} from "@/lib/server-helpers";
import { PASSING_SCORE, calculateTotalScore } from "@/lib/constants";
import type {
  RegisterTopicFormData,
  AssignCommitteeFormData,
  TopicStatus,
} from "@/types";
import { uploadFileToDrive } from "@/lib/drive-client";
import { generateBBHD } from "@/lib/generate-bb";

// ============================================================
// 1. ĐĂNG KÝ ĐỀ TÀI (Sinh viên)
// ============================================================

export async function registerTopicAction(
  formData: RegisterTopicFormData,
): Promise<ActionResult<{ topicId: string }>> {
  try {
    const user = await requireAuth();
    if (user.system_role !== "STUDENT")
      return err("Chỉ sinh viên mới được đăng ký đề tài");

    const term = await db.terms.getActive();
    if (!term) return err("Chưa có học kỳ đang hoạt động. Liên hệ Admin.");

    const existingTopics = await db.topics.filter({ student_id: user.id });
    const activeStatuses: TopicStatus[] = [
      "MOI_DANG_KY",
      "CHO_GVHD_DUYET",
      "DANG_THUC_HIEN",
    ];
    const hasActive = existingTopics.some((t) =>
      activeStatuses.includes(t.current_status as TopicStatus),
    );
    if (hasActive)
      return err("Bạn đang có đề tài chưa hoàn thành. Không thể đăng ký thêm.");

    let resolvedSupervisorId = formData.supervisor_id;
    // BCTT: tự động vào DANG_THUC_HIEN (không cần GV xác nhận)
    // KLTN: tự động vào DANG_THUC_HIEN (GV từ BCTT)
    let initialStatus: TopicStatus = "DANG_THUC_HIEN";

    if (formData.topic_type === "KLTN") {
      // KLTN: lấy GVHD từ BCTT đã hoàn tất, bỏ qua kiểm tra/tăng quota
      const passedBctt = existingTopics.find(
        (t) => t.topic_type === "BCTT" && t.current_status === "HOAN_TAT",
      );
      if (!passedBctt)
        return err("Bạn cần hoàn thành Báo cáo thực tập (BCTT) trước khi đăng ký Khóa luận tốt nghiệp (KLTN).");
      if (!passedBctt.supervisor_id)
        return err("Không tìm thấy thông tin giảng viên hướng dẫn từ BCTT.");

      resolvedSupervisorId = passedBctt.supervisor_id;
      initialStatus = "DANG_THUC_HIEN"; // Bỏ qua bước duyệt GVHD, không tăng quota
    } else {
      // BCTT: kiểm tra quota + trừ slot ngay khi đăng ký
      const studentUser = await db.users.findById(user.id);
      const rawTrainingSystem = studentUser?.training_system ?? "";
      // Normalize: "Đại trà" → "REGULAR", "CLC" giữ nguyên
      const trainingSystem =
        rawTrainingSystem === "Đại trà" || rawTrainingSystem === "DT" || rawTrainingSystem === "ĐT"
          ? "REGULAR"
          : rawTrainingSystem;

      const supervisorUser = await db.users.findById(formData.supervisor_id);
      const supervisorKey = supervisorUser?.email ?? formData.supervisor_id;
      const quota = await db.quotas.findByLecturer(
        supervisorKey,
        term.academic_year,
        term.semester,
        trainingSystem,
      );

      if (!quota)
        return err("Giảng viên này chưa có hạn mức trong học kỳ hiện tại");
      if (quota.is_approved?.toString().toLowerCase() === "false")
        return err("Giảng viên này chưa được mở slot đăng ký. Vui lòng liên hệ Trưởng bộ môn.");
      if (Number(quota.current_count) >= Number(quota.quota))
        return err("Giảng viên này đã đạt giới hạn số lượng sinh viên hướng dẫn");

      // Trừ slot ngay khi SV đăng ký
      await db.quotas.update(quota.id, {
        current_count: Number(quota.current_count) + 1,
        updated_at: nowISO(),
      });
    }

    const topicId = generateId();
    const now = nowISO();
    const resolvedAcademicYear = formData.academic_year || term.academic_year;
    const resolvedSemester = formData.semester || term.semester;

    await db.topics.create({
      id: topicId,
      student_id: user.id,
      supervisor_id: resolvedSupervisorId,
      reviewer_id: "",
      title: formData.title,
      field: formData.field,
      department: formData.department ?? "",
      company_name: formData.company_name ?? "",
      topic_type: formData.topic_type,
      topic_category: formData.topic_type === "KLTN" ? (formData.topic_category ?? "") : "",
      academic_year: resolvedAcademicYear,
      semester: resolvedSemester,
      batch: formData.batch || term.batch,
      summary: formData.summary ?? "",
      current_status: initialStatus,
      created_at: now,
      updated_at: now,
    });

    await recordStatusChange(
      topicId,
      "",
      initialStatus,
      user.id,
      formData.topic_type === "KLTN"
        ? "Sinh viên đăng ký KLTN (GVHD từ BCTT)"
        : "Sinh viên đăng ký đề tài",
    );

    if (formData.topic_type === "BCTT") {
      const supervisor = await db.users.findById(resolvedSupervisorId);
      if (supervisor) {
        await sendNotification(
          supervisor.id,
          "Sinh viên đăng ký BCTT mới",
          `${user.name} đã đăng ký thực tập với đề tài: "${formData.title}". Đề tài đã được kích hoạt — vui lòng vào hệ thống để xem.`,
        );
      }
    } else {
      // KLTN: thông báo cho GVHD biết đề tài đã được tạo tự động
      const supervisor = await db.users.findById(resolvedSupervisorId);
      if (supervisor) {
        await sendNotification(
          supervisor.id,
          "Sinh viên đã đăng ký Khóa luận tốt nghiệp",
          `${user.name} đã đăng ký KLTN với đề tài: "${formData.title}". Đề tài đã ở trạng thái Đang thực hiện.`,
        );
      }
    }

    await writeAuditLog(user.id, "REGISTER_TOPIC", "topics", topicId, {
      title: formData.title,
    });
    revalidatePath("/");

    return ok(
      { topicId },
      formData.topic_type === "BCTT"
        ? "Đăng ký BCTT thành công! Bạn có thể bắt đầu thực hiện ngay."
        : "Đăng ký đề tài thành công!",
    );
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Đã xảy ra lỗi, vui lòng thử lại",
    );
  }
}

// ============================================================
// 1b. GVHD XÁC NHẬN "ĐÃ XEM" BCTT
// ============================================================

export async function markBcttSeenAction(topicId: string): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");
    if (topic.topic_type !== "BCTT") return err("Chỉ áp dụng cho BCTT");

    await db.topics.update(topicId, {
      supervisor_seen: "true",
      updated_at: nowISO(),
    });

    await writeAuditLog(user.id, "BCTT_SEEN", "topics", topicId, {});
    revalidatePath("/");
    return ok(undefined, "Đã xác nhận xem BCTT");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function markAllBcttSeenAction(topicIds: string[]): Promise<ActionResult> {
  try {
    if (!topicIds.length) return ok(undefined, "Không có BCTT nào cần đánh dấu");
    const user = await requireAuth();
    const userId = user.id;

    for (const topicId of topicIds) {
      const topic = await db.topics.findById(topicId);
      if (!topic || topic.supervisor_id !== userId || topic.topic_type !== "BCTT") continue;
      await db.topics.update(topicId, { supervisor_seen: "true", updated_at: nowISO() });
      await writeAuditLog(userId, "BCTT_SEEN", "topics", topicId, {});
    }

    revalidatePath("/");
    return ok(undefined, "Đã xác nhận xem tất cả BCTT");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 2. GVHD ĐỒNG Ý / TỪ CHỐI HƯỚNG DẪN
// ============================================================

export async function approveSupervisorAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");
    if (topic.current_status !== "CHO_GVHD_DUYET") {
      return err("Đề tài không ở trạng thái chờ xác nhận");
    }

    // Quota đã được trừ lúc SV đăng ký — không tăng lại ở đây

    await db.topics.update(topicId, {
      current_status: "DANG_THUC_HIEN",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CHO_GVHD_DUYET",
      "DANG_THUC_HIEN",
      user.id,
      "GVHD đồng ý hướng dẫn",
    );

    await sendNotification(
      topic.student_id,
      "Giảng viên hướng dẫn đã xác nhận",
      `Chúc mừng! Giảng viên hướng dẫn đã đồng ý hướng dẫn đề tài của bạn. Bắt đầu thực hiện nhé!`,
    );

    await writeAuditLog(user.id, "APPROVE_SUPERVISION", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã xác nhận hướng dẫn thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function rejectSupervisorAction(
  topicId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    // Hoàn trả slot quota khi từ chối BCTT
    if (topic.topic_type === "BCTT") {
      const supervisorKey = user.email ?? user.id;
      const quota = await db.quotas.findByLecturer(supervisorKey, topic.academic_year, topic.semester);
      if (quota && Number(quota.current_count) > 0) {
        await db.quotas.update(quota.id, {
          current_count: Number(quota.current_count) - 1,
          updated_at: nowISO(),
        });
      }
    }

    await db.topics.update(topicId, {
      current_status: "GVHD_TU_CHOI",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CHO_GVHD_DUYET",
      "GVHD_TU_CHOI",
      user.id,
      reason,
    );

    await sendNotification(
      topic.student_id,
      "Giảng viên hướng dẫn từ chối",
      `Đáng tiếc, giảng viên đã từ chối hướng dẫn đề tài của bạn. Lý do: ${reason}. Vui lòng chọn giảng viên khác.`,
    );

    await writeAuditLog(user.id, "REJECT_SUPERVISION", "topics", topicId, {
      reason,
    });
    revalidatePath("/");
    return ok(undefined, "Đã từ chối hướng dẫn");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function updateTopicTitleAction(
  topicId: string,
  newTitle: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");
    if (topic.supervisor_id !== user.id) return err("Bạn không phải GVHD của đề tài này");
    const trimmed = newTitle.trim();
    if (!trimmed) return err("Tên đề tài không được để trống");
    await db.topics.update(topicId, { title: trimmed, updated_at: nowISO() });
    revalidatePath("/supervisor/students");
    return ok(undefined, "Đã cập nhật tên đề tài");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function batchApproveSupervisorAction(
  topicIds: string[],
): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  try {
    const user = await requireAuth();
    let succeeded = 0;
    let failed = 0;

    for (const topicId of topicIds) {
      const topic = await db.topics.findById(topicId);
      if (!topic || topic.supervisor_id !== user.id || topic.current_status !== "CHO_GVHD_DUYET") {
        failed++;
        continue;
      }
      // Quota đã được trừ lúc SV đăng ký — không tăng lại
      await db.topics.update(topicId, { current_status: "DANG_THUC_HIEN", updated_at: nowISO() });
      await recordStatusChange(topicId, "CHO_GVHD_DUYET", "DANG_THUC_HIEN", user.id, "GVHD đồng ý hướng dẫn");
      await sendNotification(topic.student_id, "Giảng viên hướng dẫn đã xác nhận",
        "Chúc mừng! Giảng viên hướng dẫn đã đồng ý hướng dẫn đề tài của bạn. Bắt đầu thực hiện nhé!");
      await writeAuditLog(user.id, "APPROVE_SUPERVISION", "topics", topicId);
      succeeded++;
    }
    revalidatePath("/");
    return ok({ succeeded, failed }, `Đã đồng ý ${succeeded} đề tài${failed > 0 ? `, ${failed} thất bại` : ""}`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function batchRejectSupervisorAction(
  topicIds: string[],
  reason: string,
): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  try {
    const user = await requireAuth();
    let succeeded = 0;
    let failed = 0;

    for (const topicId of topicIds) {
      const topic = await db.topics.findById(topicId);
      if (!topic || topic.supervisor_id !== user.id || topic.current_status !== "CHO_GVHD_DUYET") {
        failed++;
        continue;
      }
      // Hoàn trả slot quota khi từ chối BCTT
      if (topic.topic_type === "BCTT") {
        const supervisorKey = user.email ?? user.id;
        const quota = await db.quotas.findByLecturer(supervisorKey, topic.academic_year, topic.semester);
        if (quota && Number(quota.current_count) > 0) {
          await db.quotas.update(quota.id, {
            current_count: Number(quota.current_count) - 1,
            updated_at: nowISO(),
          });
        }
      }
      await db.topics.update(topicId, { current_status: "GVHD_TU_CHOI", updated_at: nowISO() });
      await recordStatusChange(topicId, "CHO_GVHD_DUYET", "GVHD_TU_CHOI", user.id, reason);
      await sendNotification(topic.student_id, "Giảng viên hướng dẫn từ chối",
        `Đáng tiếc, giảng viên đã từ chối hướng dẫn đề tài của bạn. Lý do: ${reason}. Vui lòng chọn giảng viên khác.`);
      await writeAuditLog(user.id, "REJECT_SUPERVISION", "topics", topicId, { reason });
      succeeded++;
    }
    revalidatePath("/");
    return ok({ succeeded, failed }, `Đã từ chối ${succeeded} đề tài${failed > 0 ? `, ${failed} thất bại` : ""}`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 3. TRƯỞNG KHOA DUYỆT
// ============================================================

export async function approveDeanAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");
    if (topic.current_status !== "CHO_TRUONG_KHOA_DUYET") {
      return err("Đề tài không ở trạng thái chờ Trưởng khoa duyệt");
    }

    await db.topics.update(topicId, {
      current_status: "DANG_THUC_HIEN",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CHO_TRUONG_KHOA_DUYET",
      "DANG_THUC_HIEN",
      user.id,
      "Trưởng khoa phê duyệt",
    );

    await sendNotification(
      topic.student_id,
      "Đề tài đã được phê duyệt!",
      `Chúc mừng! Đề tài "${topic.title}" của bạn đã được Trưởng khoa phê duyệt. Bắt đầu thực hiện ngay nhé!`,
    );

    await writeAuditLog(user.id, "APPROVE_TOPIC_DEAN", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã phê duyệt đề tài");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 4. CHẤM ĐIỂM
// ============================================================

export async function submitScoreAction(
  topicId: string,
  scoreValue: number,
  comment: string,
  role: "SUPERVISOR" | "REVIEWER" | "COMMITTEE_MEMBER",
): Promise<ActionResult> {
  try {
    // Thang điểm 0–10
    const maxScore = 10;
    if (scoreValue < 0 || scoreValue > maxScore) {
      return err("Điểm không hợp lệ");
    }

    let user;
    if (role === "SUPERVISOR") user = await guardSupervisorAction(topicId);
    else if (role === "REVIEWER") user = await guardReviewerAction(topicId);
    else user = await guardCouncilAction(topicId);

    // Thư ký hội đồng không được chấm điểm
    if (role === "COMMITTEE_MEMBER") {
      const committeeForCheck = await db.committees.findByTopic(topicId);
      if (committeeForCheck?.secretary_id === user.id) {
        return err("Thư ký hội đồng không được phép chấm điểm");
      }
    }

    const existing = await db.scores.filter({
      topic_id: topicId,
      scorer_id: user.id,
      score_role: role,
    });

    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    // Tách riêng các cột để dễ đọc trong sheet
    let commentText = comment;
    let cauHoi = "";
    const criteriaValues: Record<string, string> = {};
    try {
      const parsed = JSON.parse(comment);
      commentText = parsed.__text ?? "";
      cauHoi = parsed.__cau_hoi ?? "";
      const criteria = parsed.__criteria ?? {};
      for (const [key, val] of Object.entries(criteria)) {
        criteriaValues[key] = String(val);
      }
    } catch { /* not JSON, keep as-is */ }

    const scoreData = {
      score_value: scoreValue,
      comment,
      comment_text: commentText,
      cau_hoi: cauHoi,
      ...criteriaValues, // tc1, tc2, tc3, ...
    };

    if (existing.length > 0) {
      // Dedupe: nếu có >1 row (race condition cũ), giữ row mới nhất + xóa các row khác.
      const sorted = [...existing].sort((a, b) => {
        const ta = a.updated_at ?? a.created_at ?? "";
        const tb = b.updated_at ?? b.created_at ?? "";
        return tb.localeCompare(ta); // mới nhất lên đầu
      });
      const keep = sorted[0];
      const extras = sorted.slice(1);
      await db.scores.update(keep.id, { ...scoreData, updated_at: nowISO() });
      // Xóa các row trùng (fire-and-forget, không block flow)
      for (const extra of extras) {
        sheetDeleteRow(SHEET_NAMES.SCORES, extra.id).catch(() => { /* silent */ });
      }
    } else {
      await db.scores.create({
        id: generateId(),
        topic_id: topicId,
        scorer_id: user.id,
        score_role: role,
        topic_type: topic.topic_type ?? "",
        ...scoreData,
        created_at: nowISO(),
        updated_at: nowISO(),
      });
    }

    if (role === "SUPERVISOR") {
      const isBCTT = topic.topic_type === "BCTT";

      if (isBCTT) {
        // BCTT: đạt → HOAN_TAT, không đạt → giữ DA_NOP_BAO_CAO để nộp lại
        const newStatus = scoreValue >= PASSING_SCORE ? "HOAN_TAT" : "DA_NOP_BAO_CAO";
        await db.topics.update(topicId, {
          current_status: newStatus,
          updated_at: nowISO(),
        });
        await recordStatusChange(
          topicId,
          topic.current_status,
          newStatus,
          user.id,
          `GVHD chấm điểm BCTT: ${scoreValue}`,
        );
        if (scoreValue >= PASSING_SCORE) {
          await sendNotification(
            topic.student_id,
            "Hoàn tất Báo cáo thực tập",
            `Báo cáo của bạn đã được GVHD chấm đạt. Chúc mừng bạn đã hoàn thành!`,
          );
        } else {
          await sendNotification(
            topic.student_id,
            "Báo cáo thực tập chưa đạt",
            `Báo cáo của bạn chưa đạt yêu cầu của GVHD. Vui lòng liên hệ giảng viên để được hướng dẫn thêm.`,
          );
        }
      } else {
        // KLTN SUPERVISOR
        const passed = scoreValue >= PASSING_SCORE;

        // Tra sheet reviewer_preassignments để lấy reviewer_email mới nhất
        const student = await db.users.findById(topic.student_id);
        const preassignment = student
          ? await db.reviewerPreassignments.findByStudent(topic.student_id, topic.academic_year, topic.semester)
            ?? await db.reviewerPreassignments.findByStudentEmail(student.email ?? "", topic.academic_year, topic.semester)
          : null;

        // Tìm user theo reviewer_email trong sheet
        let resolvedReviewerId = topic.reviewer_id ?? "";
        if (preassignment?.reviewer_email) {
          const allUsers = await db.users.getAll();
          const reviewerUser = allUsers.find(
            (u) => u.email?.toLowerCase() === preassignment.reviewer_email.toLowerCase()
          );
          if (reviewerUser) resolvedReviewerId = reviewerUser.id;
        }

        // GVHD < 5 → luôn KHONG_DAT_HUONG_DAN (override mọi status, kể cả GVPB đã chấm).
        // GVHD ≥ 5 → chỉ tiến forward nếu topic CHƯA qua pha GVPB; nếu GVPB đã chấm
        // (DA_CHAM_PHAN_BIEN/KHONG_DAT_PHAN_BIEN/HĐ...) thì GIỮ status hiện tại, tránh regress.
        const POST_REVIEWER_STATES = [
          "DA_CHAM_PHAN_BIEN",
          "KHONG_DAT_PHAN_BIEN",
          "CHO_HOI_DONG",
          "DANG_CHAM_HOI_DONG",
          "CAN_CHINH_SUA",
          "DA_NOP_BAN_CHINH_SUA",
          "CHO_GVHD_XAC_NHAN",
          "CHO_CHU_TICH_DUYET",
          "CHO_THU_KY_XAC_NHAN",
          "HOAN_TAT",
        ];
        const alreadyPastReviewer = POST_REVIEWER_STATES.includes(topic.current_status);
        const nextStatus = !passed
          ? "KHONG_DAT_HUONG_DAN"
          : alreadyPastReviewer
            ? topic.current_status
            : resolvedReviewerId ? "CHO_CHAM_PHAN_BIEN" : "DA_CHAM_HUONG_DAN";
        await db.topics.update(topicId, {
          current_status: nextStatus,
          reviewer_id: resolvedReviewerId,
          updated_at: nowISO(),
        });
        await recordStatusChange(topicId, topic.current_status, nextStatus, user.id, `GVHD chấm điểm KLTN`);
        await sendNotification(
          topic.student_id,
          passed ? "GVHD đã chấm điểm — Đạt yêu cầu" : "GVHD đã chấm điểm — Đề tài chưa đạt",
          passed
            ? `Khóa luận của bạn đã được GVHD đánh giá đạt yêu cầu. ${resolvedReviewerId ? "GVPB sẽ tiếp tục chấm điểm." : "Đang chờ phân công giảng viên phản biện."}`
            : `Khóa luận của bạn được GVHD đánh giá chưa đạt yêu cầu. Vui lòng liên hệ giảng viên để được hướng dẫn thêm.`,
        );
        if (!passed && isEmailConfigured() && student?.email) {
          try {
            await sendKltnFailedEmail({
              to: student.email,
              studentName: student.full_name ?? student.email,
              role: "GVHD",
            });
          } catch (e) {
            console.error(`Lỗi gửi email KHÔNG ĐẠT (GVHD) tới SV ${topic.student_id}:`, e);
          }
        }
        if (resolvedReviewerId) {
          await sendNotification(
            resolvedReviewerId,
            "Đến lượt bạn chấm phản biện",
            `GVHD đã hoàn tất chấm điểm đề tài "${topic.title}". Bạn có thể vào hệ thống để chấm phản biện.`,
          );
        }
      }
    }

    if (role === "REVIEWER") {
      const passed = scoreValue >= PASSING_SCORE;
      // Fail → luôn set KHONG_DAT_PHAN_BIEN (kể cả khi đã vào HĐ) để phản ánh đúng.
      // Pass → chỉ set DA_CHAM_PHAN_BIEN nếu còn ở pha phản biện; nếu đã tiến
      // qua HĐ thì giữ nguyên để không revert.
      const inReviewPhase = ["CHO_CHAM_PHAN_BIEN", "DA_CHAM_PHAN_BIEN", "KHONG_DAT_PHAN_BIEN"].includes(
        topic.current_status,
      );
      let nextStatus: string | null = null;
      if (!passed) {
        nextStatus = "KHONG_DAT_PHAN_BIEN";
      } else if (inReviewPhase) {
        nextStatus = "DA_CHAM_PHAN_BIEN";
      }
      if (nextStatus && nextStatus !== topic.current_status) {
        await db.topics.update(topicId, { current_status: nextStatus, updated_at: nowISO() });
        await recordStatusChange(
          topicId,
          topic.current_status,
          nextStatus,
          user.id,
          `GVPB chấm điểm KLTN: ${scoreValue}`,
        );
      } else {
        await db.topics.update(topicId, { updated_at: nowISO() });
      }
      await sendNotification(
        topic.student_id,
        passed ? "GVPB đã chấm điểm — Đạt yêu cầu" : "GVPB đã chấm điểm — Đề tài chưa đạt",
        passed
          ? `Khóa luận của bạn đã được GVPB đánh giá đạt yêu cầu. Đang chờ hội đồng chấm điểm.`
          : `Khóa luận của bạn được GVPB đánh giá chưa đạt yêu cầu. Vui lòng liên hệ giảng viên để được hướng dẫn thêm.`,
      );
      if (!passed && isEmailConfigured() && topic.student_id) {
        try {
          const student = (await db.users.findById(topic.student_id)) as Record<string, string> | null;
          if (student?.email) {
            await sendKltnFailedEmail({
              to: student.email,
              studentName: student.full_name ?? student.email,
              role: "GVPB",
            });
          }
        } catch (e) {
          console.error(`Lỗi gửi email KHÔNG ĐẠT (GVPB) tới SV ${topic.student_id}:`, e);
        }
      }
    }

    if (role === "COMMITTEE_MEMBER") {
      // Kiểm tra tất cả thành viên (member_1..n, không kể thư ký và chủ tịch) đã chấm chưa
      const committee = await db.committees.findByTopic(topicId);
      if (committee) {
        const memberIds = [
          committee.member_1_id,
          committee.member_2_id,
          committee.member_3_id,
          committee.member_4_id,
          committee.member_5_id,
        ].filter(Boolean) as string[];

        const allScoresNow = await db.scores.filter({ topic_id: topicId });
        const committeeScores = allScoresNow.filter((s) => s.score_role === "COMMITTEE_MEMBER");
        const scoredIds = committeeScores.map((s) => s.scorer_id);
        const allScored = memberIds.length > 0 && memberIds.every((id) => scoredIds.includes(id));

        // Thành viên đầu tiên chấm → chuyển sang DANG_CHAM_HOI_DONG
        // Bao gồm cả case data lệch: status còn ở DA_CHAM_PHAN_BIEN khi đã vào HĐ.
        if (
          topic.current_status === "CHO_HOI_DONG" ||
          topic.current_status === "DA_CHAM_PHAN_BIEN"
        ) {
          await db.topics.update(topicId, {
            current_status: "DANG_CHAM_HOI_DONG",
            updated_at: nowISO(),
          });
          await recordStatusChange(
            topicId,
            topic.current_status,
            "DANG_CHAM_HOI_DONG",
            user.id,
            "Thành viên hội đồng bắt đầu chấm điểm",
          );
        }

        if (allScored) {
          // Tất cả thành viên đã chấm → thông báo sinh viên (không kèm điểm)
          await sendNotification(
            topic.student_id,
            "Hội đồng đã hoàn tất chấm điểm",
            `Hội đồng đã hoàn tất đánh giá khóa luận "${topic.title}". Kết quả sẽ được công bố bởi thư ký hội đồng.`,
          );
          // Thông báo cho thư ký hội đồng để tổng hợp điểm
          if (committee.secretary_id) {
            await sendNotification(
              committee.secretary_id,
              "Tất cả thành viên đã chấm điểm — cần tổng hợp",
              `Tất cả thành viên hội đồng đã chấm điểm cho đề tài "${topic.title}". Vui lòng vào trang Tổng hợp để xem điểm và xử lý tiếp.`,
            );
          }
        }
      }
    }

    await writeAuditLog(user.id, `SUBMIT_SCORE_${role}`, "scores", topicId, {
      scoreValue,
      comment,
    });
    revalidatePath("/");
    return ok(undefined, "Đã lưu điểm thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 5. PHÂN CÔNG GIẢNG VIÊN PHẢN BIỆN
// ============================================================

export async function assignReviewerAction(
  topicId: string,
  reviewerId: string,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.supervisor_id === reviewerId) {
      return err("Không thể phân công giảng viên hướng dẫn làm giảng viên phản biện cho cùng đề tài");
    }

    const eligibleStatuses = ["DANG_THUC_HIEN", "CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN"];
    if (!eligibleStatuses.includes(topic.current_status)) {
      return err("Đề tài không ở trạng thái phù hợp để phân công GVPB");
    }

    // Nếu GVHD đã chấm xong → chuyển luôn sang CHO_CHAM_PHAN_BIEN
    // Nếu chưa → chỉ lưu reviewer_id, giữ nguyên trạng thái (chờ GVHD chấm)
    const gvhdDone = topic.current_status === "DA_CHAM_HUONG_DAN";
    const newStatus = gvhdDone ? "CHO_CHAM_PHAN_BIEN" : topic.current_status;

    await db.topics.update(topicId, {
      reviewer_id: reviewerId,
      current_status: newStatus,
      updated_at: nowISO(),
    });

    if (gvhdDone) {
      await recordStatusChange(topicId, topic.current_status, "CHO_CHAM_PHAN_BIEN", user.id, `Phân công GVPB`);
    }

    const reviewer = await db.users.findById(reviewerId);
    if (reviewer) {
      await sendNotification(
        reviewer.id,
        "Bạn được phân công phản biện",
        gvhdDone
          ? `Bạn được phân công làm giảng viên phản biện cho đề tài: "${topic.title}". Vui lòng vào hệ thống để chấm điểm.`
          : `Bạn được phân công làm giảng viên phản biện cho đề tài: "${topic.title}". Bạn sẽ được thông báo khi GVHD hoàn tất chấm điểm.`,
      );
    }

    await writeAuditLog(user.id, "ASSIGN_REVIEWER", "topics", topicId, { reviewerId });
    revalidatePath("/");
    return ok(undefined, gvhdDone ? "Phân công GVPB thành công" : "Đã lưu GVPB — GVPB sẽ chấm sau khi GVHD hoàn tất");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 5b. ĐỔI GVPB (đề tài đã có GVPB, không giới hạn trạng thái)
// ============================================================

export async function reassignReviewerAction(
  topicId: string,
  reviewerId: string,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.supervisor_id === reviewerId) {
      return err("Không thể phân công giảng viên hướng dẫn làm giảng viên phản biện cho cùng đề tài");
    }

    await db.topics.update(topicId, {
      reviewer_id: reviewerId,
      updated_at: nowISO(),
    });

    const reviewer = await db.users.findById(reviewerId);
    if (reviewer) {
      await sendNotification(
        reviewer.id,
        "Bạn được phân công phản biện",
        `Bạn được phân công làm giảng viên phản biện cho đề tài: "${topic.title}".`,
      );
    }

    await writeAuditLog(user.id, "REASSIGN_REVIEWER", "topics", topicId, { reviewerId });
    revalidatePath("/");
    return ok(undefined, "Đã cập nhật GVPB thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 5c. PHÂN CÔNG GVPB HÀNG LOẠT (đề tài đã đăng ký)
// ============================================================

export async function bulkAssignReviewerAction(
  topicIds: string[],
  reviewerId: string,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    if (!topicIds.length || !reviewerId) return err("Thiếu thông tin");

    const allTopics = await db.topics.getAll();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));
    const eligibleStatuses = ["DANG_THUC_HIEN", "CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN"];

    const updates: { id: string; data: Record<string, string> }[] = [];
    for (const topicId of topicIds) {
      const topic = topicMap.get(topicId);
      if (!topic) continue;
      if (topic.supervisor_id === reviewerId) continue; // bỏ qua nếu trùng GVHD
      if (!eligibleStatuses.includes(topic.current_status)) continue;
      const gvhdDone = topic.current_status === "DA_CHAM_HUONG_DAN";
      updates.push({
        id: topicId,
        data: {
          reviewer_id: reviewerId,
          current_status: gvhdDone ? "CHO_CHAM_PHAN_BIEN" : topic.current_status,
          updated_at: nowISO(),
        },
      });
    }

    if (updates.length === 0) return err("Không có đề tài hợp lệ để phân công");
    await sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, updates);
    await writeAuditLog(user.id, "BULK_ASSIGN_REVIEWER", "topics", "", { reviewerId, count: String(updates.length) } as unknown as Record<string, unknown>);
    revalidatePath("/");
    return ok(undefined, `Đã phân công GVPB cho ${updates.length} đề tài`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function autoDistributeAssignAction(
  topicIds: string[],
  reviewerIds: string[],
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    if (!topicIds.length || !reviewerIds.length) return err("Thiếu thông tin");

    const allTopics = await db.topics.getAll();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));
    const eligibleStatuses = ["DANG_THUC_HIEN", "CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN"];

    const updates: { id: string; data: Record<string, string> }[] = [];
    let reviewerIndex = 0;
    for (const topicId of topicIds) {
      const topic = topicMap.get(topicId);
      if (!topic) continue;
      if (!eligibleStatuses.includes(topic.current_status)) continue;
      // Tìm reviewer không trùng GVHD (thử từng reviewer theo vòng)
      let assigned = false;
      for (let attempt = 0; attempt < reviewerIds.length; attempt++) {
        const reviewerId = reviewerIds[(reviewerIndex + attempt) % reviewerIds.length];
        if (topic.supervisor_id === reviewerId) continue;
        const gvhdDone = topic.current_status === "DA_CHAM_HUONG_DAN";
        updates.push({
          id: topicId,
          data: {
            reviewer_id: reviewerId,
            current_status: gvhdDone ? "CHO_CHAM_PHAN_BIEN" : topic.current_status,
            updated_at: nowISO(),
          },
        });
        reviewerIndex = (reviewerIndex + attempt + 1) % reviewerIds.length;
        assigned = true;
        break;
      }
      if (!assigned) reviewerIndex = (reviewerIndex + 1) % reviewerIds.length;
    }

    if (updates.length === 0) return err("Không có đề tài hợp lệ để phân công");
    await sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, updates);
    await writeAuditLog(user.id, "AUTO_DISTRIBUTE_REVIEWER", "topics", "", { count: String(updates.length) } as unknown as Record<string, unknown>);
    revalidatePath("/");
    return ok(undefined, `Đã phân công ${updates.length} đề tài cho ${reviewerIds.length} GVPB`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 5c. PHÂN CÔNG GVPB TRƯỚC KHI ĐĂNG KÝ ĐỀ TÀI
// ============================================================

export async function autoDistributePreassignAction(
  studentIds: string[],
  reviewerEmails: string[],
  academicYear: string,
  semester: string,
): Promise<ActionResult> {
  try {
    await requireDean();
    if (!studentIds.length) return err("Không có sinh viên để phân công");
    if (!reviewerEmails.length) return err("Chưa chọn GVPB nào");

    // Đọc sheet 1 lần, xây map trong memory
    const allExisting = await db.reviewerPreassignments.getAll();
    const existingMap = new Map(
      allExisting
        .filter((r) => r.academic_year === academicYear && r.semester === semester)
        .map((r) => [r.student_id, r])
    );

    // Chuẩn bị batch, 1 read + tối đa 2 writes cho toàn bộ danh sách
    const rows: { existingId?: string; data: Record<string, string> }[] = studentIds.map((studentId, i) => {
      const reviewerEmail = reviewerEmails[i % reviewerEmails.length];
      const existing = existingMap.get(studentId);
      const row: { existingId?: string; data: Record<string, string> } = existing?.id
        ? { existingId: existing.id, data: { reviewer_email: reviewerEmail } }
        : { data: { id: generateId(), student_id: studentId, reviewer_email: reviewerEmail, academic_year: academicYear, semester, created_at: nowISO() } };
      return row;
    });
    await sheetBatchUpsert(SHEET_NAMES.REVIEWER_PREASSIGNMENTS, rows);
    revalidatePath("/");
    return ok(undefined, `Đã phân công ${studentIds.length} sinh viên cho ${reviewerEmails.length} GVPB`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function bulkPreassignReviewerAction(
  studentIds: string[],
  reviewerEmail: string,
  academicYear: string,
  semester: string,
): Promise<ActionResult> {
  try {
    await requireDean();
    if (!studentIds.length || !reviewerEmail) return err("Thiếu thông tin sinh viên hoặc giảng viên");

    // Đọc sheet 1 lần duy nhất, filter trong memory
    const allExisting = await db.reviewerPreassignments.getAll();
    const existingMap = new Map(
      allExisting
        .filter((r) => r.academic_year === academicYear && r.semester === semester)
        .map((r) => [r.student_id, r])
    );

    const rows: { existingId?: string; data: Record<string, string> }[] = studentIds.map((studentId) => {
      const existing = existingMap.get(studentId);
      const row: { existingId?: string; data: Record<string, string> } = existing?.id
        ? { existingId: existing.id, data: { reviewer_email: reviewerEmail } }
        : { data: { id: generateId(), student_id: studentId, reviewer_email: reviewerEmail, academic_year: academicYear, semester, created_at: nowISO() } };
      return row;
    });
    await sheetBatchUpsert(SHEET_NAMES.REVIEWER_PREASSIGNMENTS, rows);
    revalidatePath("/");
    return ok(undefined, `Đã phân công GVPB cho ${studentIds.length} sinh viên`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function preassignReviewerAction(
  studentId: string,
  reviewerEmail: string,
  academicYear: string,
  semester: string,
): Promise<ActionResult> {
  try {
    await requireDean();
    if (!studentId || !reviewerEmail) return err("Thiếu thông tin sinh viên hoặc giảng viên");

    const existing = await db.reviewerPreassignments.findByStudent(studentId, academicYear, semester);
    if (existing?.id) {
      await db.reviewerPreassignments.update(existing.id, { reviewer_email: reviewerEmail });
    } else {
      await db.reviewerPreassignments.create({
        id: generateId(),
        student_id: studentId,
        reviewer_email: reviewerEmail,
        academic_year: academicYear,
        semester,
        created_at: nowISO(),
      });
    }
    revalidatePath("/");
    return ok(undefined, "Đã lưu phân công GVPB");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 6. PHÂN CÔNG HỘI ĐỒNG
// ============================================================

export async function assignCommitteeAction(
  topicId: string,
  data: AssignCommitteeFormData,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    await db.committees.create({
      id: generateId(),
      topic_id: topicId,
      committee_name: data.committee_name,
      secretary_id: data.secretary_id,
      chair_id: data.chair_id ?? "",
      member_1_id: data.member_1_id ?? "",
      member_2_id: data.member_2_id ?? "",
      member_3_id: data.member_3_id ?? "",
      member_4_id: data.member_4_id ?? "",
      member_5_id: data.member_5_id ?? "",
      defense_date: data.defense_date ?? "",
      defense_location: data.defense_location ?? "",
      created_by: user.id,
      created_at: nowISO(),
    });

    await db.topics.update(topicId, {
      current_status: "CHO_HOI_DONG",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      topic.current_status,
      "CHO_HOI_DONG",
      user.id,
      `Phân công hội đồng: ${data.committee_name}`,
    );

    const memberIds = [
      data.secretary_id,
      data.chair_id,
      data.member_1_id,
      data.member_2_id,
      data.member_3_id,
      data.member_4_id,
      data.member_5_id,
    ].filter(Boolean) as string[];
    for (const memberId of memberIds) {
      await sendNotification(
        memberId,
        "Bạn được phân công vào hội đồng",
        `Bạn được phân công vào hội đồng "${data.committee_name}" để đánh giá đề tài: "${topic.title}".`,
      );
    }

    await writeAuditLog(user.id, "ASSIGN_COMMITTEE", "topics", topicId, data as unknown as Record<string, unknown>);
    revalidatePath("/");
    return ok(undefined, "Phân công hội đồng thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function bulkAssignCommitteeAction(
  topicIds: string[],
  data: AssignCommitteeFormData,
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    if (topicIds.length === 0) return err("Chưa chọn đề tài nào");

    const allTopics = await db.topics.getAll();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));

    const committeeRows = topicIds.map((topicId) => ({
      id: generateId(),
      topic_id: topicId,
      committee_name: data.committee_name,
      secretary_id: data.secretary_id,
      chair_id: data.chair_id ?? "",
      member_1_id: data.member_1_id ?? "",
      member_2_id: data.member_2_id ?? "",
      member_3_id: data.member_3_id ?? "",
      member_4_id: data.member_4_id ?? "",
      member_5_id: data.member_5_id ?? "",
      defense_date: data.defense_date ?? "",
      defense_location: data.defense_location ?? "",
      created_by: user.id,
      created_at: nowISO(),
    }));

    for (const row of committeeRows) {
      await db.committees.create(row);
    }

    const topicUpdates = topicIds.map((topicId) => ({
      id: topicId,
      data: { current_status: "CHO_HOI_DONG", updated_at: nowISO() },
    }));
    await sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, topicUpdates);

    for (const topicId of topicIds) {
      const topic = topicMap.get(topicId);
      if (!topic) continue;
      await recordStatusChange(topicId, topic.current_status, "CHO_HOI_DONG", user.id, `Phân công hội đồng: ${data.committee_name}`);
    }

    revalidatePath("/");
    return ok(undefined, `Đã thành lập hội đồng cho ${topicIds.length} đề tài`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// --- Flow mới: tạo HĐ trước, add SV sau ---

export async function createCommitteeAction(data: {
  committee_name: string;
  defense_date: string;
  defense_session?: string; // "MORNING" | "AFTERNOON" | ""
  defense_location?: string;
  chair_id?: string;
  secretary_id: string;
  member_1_id?: string;
  member_2_id?: string;
  member_3_id?: string;
  member_4_id?: string;
  member_5_id?: string;
}): Promise<ActionResult<{ committeeId: string }>> {
  try {
    const user = await requireDean();
    if (!data.committee_name.trim()) return err("Vui lòng nhập tên hội đồng");
    if (!data.secretary_id) return err("Vui lòng chọn thư ký hội đồng");
    if (!data.defense_date) return err("Vui lòng chọn ngày bảo vệ");

    const committeeId = generateId();
    await db.committees.create({
      id: committeeId,
      committee_name: data.committee_name,
      defense_date: data.defense_date,
      defense_session: data.defense_session ?? "",
      defense_location: data.defense_location ?? "",
      chair_id: data.chair_id ?? "",
      secretary_id: data.secretary_id,
      member_1_id: data.member_1_id ?? "",
      member_2_id: data.member_2_id ?? "",
      member_3_id: data.member_3_id ?? "",
      member_4_id: data.member_4_id ?? "",
      member_5_id: data.member_5_id ?? "",
      created_by: user.id,
      created_at: nowISO(),
    });

    await writeAuditLog(user.id, "CREATE_COMMITTEE", "committees", committeeId, data as unknown as Record<string, unknown>);

    // Gửi email cho tất cả thành viên HĐ (chủ tịch, thư ký, member 1-5)
    if (isEmailConfigured()) {
      const memberAssignments: Array<{ userId: string; role: CommitteeRoleLabel }> = [];
      if (data.chair_id) memberAssignments.push({ userId: data.chair_id, role: "Chủ tịch" });
      if (data.secretary_id) memberAssignments.push({ userId: data.secretary_id, role: "Thư ký" });
      for (const memberId of [data.member_1_id, data.member_2_id, data.member_3_id, data.member_4_id, data.member_5_id]) {
        if (memberId) memberAssignments.push({ userId: memberId, role: "Thành viên" });
      }

      const dateStr = data.defense_date;
      const defenseDateFormatted = dateStr
        ? (() => {
            const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
            return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
          })()
        : "";
      const sessionLabel = data.defense_session === "MORNING" ? "Buổi sáng" : data.defense_session === "AFTERNOON" ? "Buổi chiều" : "";

      await Promise.all(
        memberAssignments.map(async ({ userId, role }) => {
          try {
            const u = (await db.users.findById(userId)) as Record<string, string> | null;
            if (!u?.email) return;
            await sendCommitteeAssignmentEmail({
              to: u.email,
              recipientName: u.full_name ?? u.email,
              role,
              committeeName: data.committee_name,
              defenseDateFormatted,
              defenseSessionLabel: sessionLabel,
              defenseLocation: data.defense_location ?? "",
            });
          } catch (e) {
            console.error(`Lỗi gửi email phân công HĐ tới user ${userId}:`, e);
          }
        }),
      );
    }

    revalidatePath("/");
    return ok({ committeeId }, "Đã tạo hội đồng thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function updateCommitteeAction(
  committeeId: string,
  data: {
    committee_name: string;
    defense_date: string;
    defense_session?: string;
    defense_location?: string;
    chair_id?: string;
    secretary_id: string;
    member_1_id?: string;
    member_2_id?: string;
    member_3_id?: string;
    member_4_id?: string;
    member_5_id?: string;
  },
): Promise<ActionResult> {
  try {
    await requireDean();
    if (!data.committee_name.trim()) return err("Vui lòng nhập tên hội đồng");
    if (!data.secretary_id) return err("Vui lòng chọn thư ký hội đồng");

    // Lấy committee cũ để so sánh diff thành viên
    const oldCommittee = (await db.committees
      .findById(committeeId)
      .catch(() => null)) as Record<string, string> | null;

    await db.committees.update(committeeId, {
      committee_name: data.committee_name,
      defense_date: data.defense_date,
      defense_session: data.defense_session ?? "",
      defense_location: data.defense_location ?? "",
      chair_id: data.chair_id ?? "",
      secretary_id: data.secretary_id,
      member_1_id: data.member_1_id ?? "",
      member_2_id: data.member_2_id ?? "",
      member_3_id: data.member_3_id ?? "",
      member_4_id: data.member_4_id ?? "",
      member_5_id: data.member_5_id ?? "",
      updated_at: nowISO(),
    });

    // Gửi email cho thành viên MỚI được thêm hoặc đổi vai trò
    if (isEmailConfigured() && oldCommittee) {
      const buildRoleMap = (c: Record<string, string | undefined>) => {
        const map = new Map<string, CommitteeRoleLabel>();
        if (c.chair_id) map.set(c.chair_id, "Chủ tịch");
        if (c.secretary_id) map.set(c.secretary_id, "Thư ký");
        for (const m of [c.member_1_id, c.member_2_id, c.member_3_id, c.member_4_id, c.member_5_id]) {
          if (m && !map.has(m)) map.set(m, "Thành viên");
        }
        return map;
      };
      const oldRoles = buildRoleMap(oldCommittee);
      const newRoles = buildRoleMap(data);

      const changedUserIds: string[] = [];
      for (const [userId, role] of newRoles) {
        if (oldRoles.get(userId) !== role) changedUserIds.push(userId);
      }

      if (changedUserIds.length > 0) {
        const dateStr = data.defense_date;
        const defenseDateFormatted = dateStr
          ? (() => {
              const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
              return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
            })()
          : "";
        const sessionLabel = data.defense_session === "MORNING" ? "Buổi sáng" : data.defense_session === "AFTERNOON" ? "Buổi chiều" : "";

        await Promise.all(
          changedUserIds.map(async (userId) => {
            try {
              const u = (await db.users.findById(userId)) as Record<string, string> | null;
              if (!u?.email) return;
              await sendCommitteeAssignmentEmail({
                to: u.email,
                recipientName: u.full_name ?? u.email,
                role: newRoles.get(userId)!,
                committeeName: data.committee_name,
                defenseDateFormatted,
                defenseSessionLabel: sessionLabel,
                defenseLocation: data.defense_location ?? "",
              });
            } catch (e) {
              console.error(`Lỗi gửi email phân công HĐ (update) tới user ${userId}:`, e);
            }
          }),
        );
      }
    }

    revalidatePath("/");
    return ok(undefined, "Đã cập nhật hội đồng");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function addTopicsToCommitteeAction(
  committeeId: string,
  topicIds: string[],
): Promise<ActionResult> {
  try {
    const user = await requireDean();
    if (topicIds.length === 0) return err("Chưa chọn đề tài nào");

    const committee = await db.committees.findById(committeeId);
    if (!committee) return err("Không tìm thấy hội đồng");

    const allTopics = await db.topics.getAll();
    const topicMap = new Map(allTopics.map((t) => [t.id, t]));

    // Đảm bảo sheet có cột order_index (thứ tự thuyết trình)
    await ensureSheetColumn(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, "order_index");

    // Lấy order_index lớn nhất hiện tại của HĐ để tiếp nối
    const existing = await db.committeeTopics
      .filter({ committee_id: committeeId })
      .catch(() => [] as Record<string, string>[]);
    const maxOrder = existing.reduce((m, a) => {
      const n = parseInt(a.order_index ?? "", 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    // Thêm vào committee_assignments
    for (let i = 0; i < topicIds.length; i++) {
      await db.committeeTopics.create({
        id: generateId(),
        committee_id: committeeId,
        topic_id: topicIds[i],
        order_index: String(maxOrder + i + 1),
        created_at: nowISO(),
      });
    }

    // Cập nhật trạng thái topic
    const topicUpdates = topicIds.map((topicId) => ({
      id: topicId,
      data: { current_status: "CHO_HOI_DONG", updated_at: nowISO() },
    }));
    await sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, topicUpdates);

    for (const topicId of topicIds) {
      const topic = topicMap.get(topicId);
      if (!topic) continue;
      await recordStatusChange(topicId, topic.current_status, "CHO_HOI_DONG", user.id, `Thêm vào hội đồng: ${committee.committee_name}`);
    }

    revalidatePath("/");
    return ok(undefined, `Đã thêm ${topicIds.length} đề tài vào hội đồng`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function removeTopicFromCommitteeAction(
  assignmentId: string,
  topicId: string,
): Promise<ActionResult> {
  try {
    await requireDean();

    await db.committeeTopics.delete(assignmentId);
    await db.topics.update(topicId, { current_status: "DA_CHAM_PHAN_BIEN", updated_at: nowISO() });

    revalidatePath("/");
    return ok(undefined, "Đã xóa đề tài khỏi hội đồng");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/** Cập nhật thứ tự thuyết trình của các đề tài trong 1 hội đồng. */
export async function reorderCommitteeTopicsAction(
  committeeId: string,
  orderedAssignmentIds: string[],
): Promise<ActionResult> {
  try {
    await requireDean();
    if (orderedAssignmentIds.length === 0) return err("Danh sách trống");

    await ensureSheetColumn(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, "order_index");

    const now = nowISO();
    await sheetBatchRangeUpdate(
      SHEET_NAMES.COMMITTEE_ASSIGNMENTS,
      orderedAssignmentIds.map((assignmentId, idx) => ({
        id: assignmentId,
        data: { order_index: String(idx + 1), updated_at: now },
      })),
    );

    revalidatePath("/");
    return ok(undefined, "Đã cập nhật thứ tự");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function deleteCommitteeAction(
  committeeId: string,
): Promise<ActionResult> {
  try {
    await requireDean();

    // Xóa tất cả assignments và hoàn trả trạng thái đề tài
    const assignments = await db.committeeTopics.filter({ committee_id: committeeId }).catch(() => [] as Record<string, string>[]);
    await Promise.all(
      assignments.map(async (a) => {
        await db.committeeTopics.delete(a.id);
        await db.topics.update(a.topic_id, { current_status: "DA_CHAM_PHAN_BIEN", updated_at: nowISO() });
      })
    );

    await db.committees.delete(committeeId);

    revalidatePath("/");
    return ok(undefined, "Đã xóa hội đồng");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * Autosave bản nháp biên bản hội đồng — chỉ lưu text vào sheet, không đổi status,
 * không gửi notification, không upload Drive. Dùng cho debounce lưu khi thư ký gõ.
 */
export async function autosaveBienBanHdDraftAction(
  topicId: string,
  nhanXetHd: string,
  yeuCauChinhSua: string,
): Promise<ActionResult> {
  try {
    await guardSecretaryAction(topicId);
    const assignment = await db.committeeTopics.findByTopic(topicId);
    if (!assignment) return err("Không tìm thấy đề tài trong hội đồng");
    await db.committeeTopics.update(assignment.id, {
      nhan_xet_hd: nhanXetHd,
      yeu_cau_chinh_sua: yeuCauChinhSua,
      updated_at: nowISO(),
    });
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/** Thư ký lưu thời gian thuyết trình (phút) cho 1 đề tài. Dùng autosave. */
export async function savePresentationTimeAction(
  topicId: string,
  minutes: number | null,
): Promise<ActionResult> {
  try {
    await guardSecretaryAction(topicId);
    const assignment = await db.committeeTopics.findByTopic(topicId);
    if (!assignment) return err("Không tìm thấy đề tài trong hội đồng");
    await ensureSheetColumn(SHEET_NAMES.COMMITTEE_ASSIGNMENTS, "presentation_minutes");
    await db.committeeTopics.update(assignment.id, {
      presentation_minutes: minutes === null ? "" : String(minutes),
      updated_at: nowISO(),
    });
    return ok(undefined);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function saveBienBanHdAction(
  topicId: string,
  nhanXetHd: string,
  yeuCauChinhSua: string,
): Promise<ActionResult> {
  try {
    const user = await guardSecretaryAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    // 1. Lưu nội dung biên bản
    const assignment = await db.committeeTopics.findByTopic(topicId);
    if (!assignment) return err("Không tìm thấy đề tài trong hội đồng");
    await db.committeeTopics.update(assignment.id, {
      nhan_xet_hd: nhanXetHd,
      yeu_cau_chinh_sua: yeuCauChinhSua,
      updated_at: nowISO(),
    });

    // 2. Tạo file Word biên bản và upload lên Drive (replace bản cũ — chỉ giữ 1 file mới nhất)
    try {
      const student = await db.users.findById(topic.student_id);
      const outputBuffer = await generateBBHD(topicId);
      if (outputBuffer) {
        // Xóa các bản BBHD cũ để chỉ giữ 1 file mới nhất
        const existing = await db.files.filter({
          topic_id: topicId,
          file_type: "BIEN_BAN_HOI_DONG",
        });
        for (const old of existing) {
          await db.files.delete(old.id, "BIEN_BAN_HOI_DONG");
        }

        const fileName = `BB_HoiDong_${student?.student_code ?? topicId}.docx`;
        const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
        const { fileUrl } = await uploadFileToDrive(
          outputBuffer,
          fileName,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          rootFolderId,
        );
        const fileId = generateId();
        await db.files.create({
          id: fileId,
          topic_id: topicId,
          uploaded_by: user.id,
          file_type: "BIEN_BAN_HOI_DONG",
          original_name: fileName,
          stored_name: fileId,
          file_url: fileUrl,
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          file_size: outputBuffer.length,
          uploaded_at: nowISO(),
        });
      }
    } catch (e) {
      console.error("[saveBienBanHd] generate/upload BBHD error:", e);
      // Không để lỗi file block việc lưu biên bản
    }
    // Lưu biên bản KHÔNG đổi status, KHÔNG gửi thông báo.
    // Việc gửi cho SV nằm ở confirmScoresAndSendBbhdAction khi thư ký bấm
    // "Xác nhận điểm và gửi BBHD" trên trang tổng hợp.

    revalidatePath("/");
    return ok(undefined, "Đã lưu biên bản");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * Gửi đồng loạt Biên bản HĐ + điểm Final cho tất cả SV trong 1 hội đồng.
 * Thư ký bấm "Xác nhận điểm và gửi BBHD" trên trang tổng hợp → chạy action này.
 */
export async function confirmScoresAndSendBbhdAction(
  committeeId: string,
): Promise<ActionResult<{ sent: number; skipped: number; skippedTitles: string[] }>> {
  try {
    const user = await requireAuth();
    const committee = await db.committees.findById(committeeId);
    if (!committee) return err("Không tìm thấy hội đồng");
    if (committee.secretary_id !== user.id) {
      return err("Chỉ thư ký hội đồng mới được thực hiện thao tác này");
    }

    const assignments = await db.committeeTopics.filter({ committee_id: committeeId });
    if (assignments.length === 0) return err("Hội đồng chưa có đề tài nào");

    let sent = 0;
    let skipped = 0;
    const skippedTitles: string[] = [];
    const skippedReasons: string[] = [];

    for (const a of assignments) {
      const topic = await db.topics.findById(a.topic_id);
      if (!topic) {
        skipped++;
        skippedReasons.push(`Topic ${a.topic_id}: không tìm thấy`);
        continue;
      }

      // Luôn generate BBHD mới (replace bản cũ) — đảm bảo file gửi SV là bản hiện tại
      try {
        const student = await db.users.findById(topic.student_id);
        const buf = await generateBBHD(topic.id);
        if (!buf) {
          skipped++;
          const title = topic.title ?? "(không tên)";
          skippedTitles.push(title);
          skippedReasons.push(`"${title}": generateBBHD return null (xem server log)`);
          continue;
        }

        // Xóa các bản BBHD cũ để chỉ giữ 1 file mới nhất
        const existing = await db.files.filter({
          topic_id: topic.id,
          file_type: "BIEN_BAN_HOI_DONG",
        });
        for (const old of existing) {
          await db.files.delete(old.id, "BIEN_BAN_HOI_DONG");
        }

        const fileName = `BB_HoiDong_${student?.student_code ?? topic.id}.docx`;
        const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
        const { fileUrl } = await uploadFileToDrive(
          buf,
          fileName,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          rootFolderId,
        );
        const fid = generateId();
        await db.files.create({
          id: fid,
          topic_id: topic.id,
          uploaded_by: user.id,
          file_type: "BIEN_BAN_HOI_DONG",
          original_name: fileName,
          stored_name: fid,
          file_url: fileUrl,
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          file_size: buf.length,
          uploaded_at: nowISO(),
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[confirmScoresAndSendBbhd] auto-generate BBHD lỗi:", e);
        skipped++;
        const title = topic.title ?? "(không tên)";
        skippedTitles.push(title);
        skippedReasons.push(`"${title}": ${errMsg}`);
        continue;
      }

      // Tính điểm Final để đính vào thông báo
      const scores = await db.scores.filter({ topic_id: topic.id });
      const sv = scores.find((s) => s.score_role === "SUPERVISOR");
      const pb = scores.find((s) => s.score_role === "REVIEWER");
      const hd = scores
        .filter((s) => s.score_role === "COMMITTEE_MEMBER")
        .map((s) => Number(s.score_value));
      const finalScore = calculateTotalScore(
        sv ? Number(sv.score_value) : undefined,
        pb ? Number(pb.score_value) : undefined,
        hd,
      );
      const finalText = finalScore != null ? `${finalScore.toFixed(2)}/10` : "chưa đủ dữ liệu";

      // Chuyển trạng thái nếu còn trong giai đoạn chấm (kể cả data lệch DA_CHAM_PHAN_BIEN)
      const council = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG", "DA_CHAM_PHAN_BIEN"];
      if (council.includes(topic.current_status)) {
        await db.topics.update(topic.id, {
          current_status: "CAN_CHINH_SUA",
          updated_at: nowISO(),
        });
        await recordStatusChange(
          topic.id,
          topic.current_status,
          "CAN_CHINH_SUA",
          user.id,
          "Thư ký gửi biên bản hội đồng cho SV",
        );
      }

      await sendNotification(
        topic.student_id,
        "Hội đồng đã gửi biên bản & điểm tổng kết",
        `Thư ký hội đồng đã gửi Biên bản hội đồng cho khóa luận "${topic.title}". Điểm Final: ${finalText}. Vui lòng xem biên bản, thực hiện chỉnh sửa (nếu có yêu cầu) và nộp lại.`,
      );
      sent++;
    }

    revalidatePath("/");
    revalidatePath("/council/summary");
    let msg = skipped > 0
      ? `Đã gửi ${sent} sinh viên. Bỏ qua ${skipped} đề tài.`
      : `Đã tạo và gửi biên bản hội đồng cho ${sent} sinh viên.`;
    if (skippedReasons.length > 0) {
      msg += `\nLý do bỏ qua:\n${skippedReasons.map((r) => `• ${r}`).join("\n")}`;
    }
    return ok({ sent, skipped, skippedTitles }, msg);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 7. YÊU CẦU CHỈNH SỬA & XÁC NHẬN (Secretary)
// ============================================================

export async function requestRevisionAction(
  topicId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await guardSecretaryAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    await db.revisions.create({
      id: generateId(),
      topic_id: topicId,
      requested_by: user.id,
      request_note: note,
      revised_file_id: "",
      is_approved: false,
      approved_by: "",
      approved_at: "",
      created_at: nowISO(),
      updated_at: nowISO(),
    });

    await db.topics.update(topicId, {
      current_status: "CAN_CHINH_SUA",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      topic.current_status,
      "CAN_CHINH_SUA",
      user.id,
      note,
    );

    await sendNotification(
      topic.student_id,
      "Yêu cầu chỉnh sửa bài",
      `Hội đồng yêu cầu bạn chỉnh sửa bài. Nội dung: ${note}. Vui lòng upload bản chỉnh sửa.`,
    );

    await writeAuditLog(user.id, "REQUEST_REVISION", "revisions", topicId, {
      note,
    });
    revalidatePath("/");
    return ok(undefined, "Đã gửi yêu cầu chỉnh sửa");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function finalizeTopicAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardChairAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    const validStatuses = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG", "CAN_CHINH_SUA", "CHO_THU_KY_XAC_NHAN"];
    if (!validStatuses.includes(topic.current_status)) {
      return err("Đề tài không ở trạng thái có thể xác nhận hoàn tất");
    }

    await db.topics.update(topicId, {
      current_status: "HOAN_TAT",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      topic.current_status,
      "HOAN_TAT",
      user.id,
      "Chủ tịch hội đồng xác nhận hoàn tất",
    );

    await sendNotification(
      topic.student_id,
      "🎉 Hoàn tất quy trình KLTN!",
      `Chúc mừng! Khóa luận tốt nghiệp "${topic.title}" đã được Chủ tịch hội đồng xác nhận hoàn tất toàn bộ quy trình.`,
    );

    await writeAuditLog(user.id, "FINALIZE_TOPIC", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã xác nhận hoàn tất quy trình KLTN");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 7b. QUY TRÌNH CHỈNH SỬA SAU HỘI ĐỒNG
// ============================================================

/**
 * Thư ký gửi biên bản cho sinh viên → CAN_CHINH_SUA
 * Biên bản đã upload rồi, chỉ cần chuyển trạng thái và thông báo SV.
 */
export async function sendBienBanToStudentAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardSecretaryAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    const councilPhases = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG", "DA_CHAM_PHAN_BIEN"];
    if (!councilPhases.includes(topic.current_status)) {
      return err("Đề tài không ở giai đoạn hội đồng");
    }

    const files = await db.files.filter({ topic_id: topicId });
    const hasBienBan = files.some((f) => f.file_type === "BIEN_BAN_HOI_DONG");
    if (!hasBienBan) {
      return err("Vui lòng upload Biên bản hội đồng trước khi gửi cho sinh viên");
    }

    await db.topics.update(topicId, {
      current_status: "CAN_CHINH_SUA",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      topic.current_status,
      "CAN_CHINH_SUA",
      user.id,
      "Thư ký gửi biên bản hội đồng — sinh viên cần chỉnh sửa",
    );

    await sendNotification(
      topic.student_id,
      "Hội đồng yêu cầu chỉnh sửa",
      `Thư ký đã gửi Biên bản hội đồng cho khóa luận "${topic.title}". Vui lòng tải biên bản, thực hiện chỉnh sửa và nộp lại 2 file: KLTN đã chỉnh sửa và Biên bản giải trình.`,
    );

    revalidatePath("/");
    return ok(undefined, "Đã gửi biên bản cho sinh viên");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * Sinh viên gửi 2 tài liệu chỉnh sửa cho GVHD xem xét.
 * Cần đã upload CHINH_SUA + PHIEU_GIAI_TRINH.
 */
export async function submitRevisionForReviewAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardStudentAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    // SV được nộp file chỉnh sửa bất cứ lúc nào, miễn là chưa qua giai đoạn duyệt
    const ALREADY_SUBMITTED_STATES = [
      "CHO_GVHD_XAC_NHAN",
      "CHO_CHU_TICH_DUYET",
      "CHO_THU_KY_XAC_NHAN",
      "HOAN_TAT",
    ];
    if (ALREADY_SUBMITTED_STATES.includes(topic.current_status)) {
      return err("Đề tài đã ở giai đoạn duyệt — không thể nộp lại file chỉnh sửa");
    }

    // Force invalidate cache 2 sheet liên quan để đọc fresh — fix lỗi cache stale
    // khi SV vừa upload xong và bấm "Gửi" ngay (đặc biệt trên Vercel multi-instance).
    invalidateSheetCache(SHEET_NAMES.FILES_CHINH_SUA);
    invalidateSheetCache(SHEET_NAMES.FILES_GIAI_TRINH);

    // Query trực tiếp theo file_type — chỉ đụng 2 sheet thay vì 11 sheet
    const [chinhSuaFiles, giaiTrinhFiles] = await Promise.all([
      db.files.filter({ topic_id: topicId, file_type: "CHINH_SUA" }),
      db.files.filter({ topic_id: topicId, file_type: "PHIEU_GIAI_TRINH" }),
    ]);
    const hasChinhSua = chinhSuaFiles.length > 0;
    const hasGiaiTrinh = giaiTrinhFiles.length > 0;

    if (!hasChinhSua || !hasGiaiTrinh) {
      return err(
        `Vui lòng upload đủ 2 tài liệu (đã có: ${hasChinhSua ? "KLTN ✓" : "KLTN ✗"}, ${hasGiaiTrinh ? "Giải trình ✓" : "Giải trình ✗"}). Nếu vừa upload xong, đợi 2-3 giây rồi thử lại.`
      );
    }

    await db.topics.update(topicId, {
      current_status: "CHO_GVHD_XAC_NHAN",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CAN_CHINH_SUA",
      "CHO_GVHD_XAC_NHAN",
      user.id,
      "Sinh viên nộp bộ tài liệu chỉnh sửa",
    );

    if (topic.supervisor_id) {
      await sendNotification(
        topic.supervisor_id,
        "Sinh viên đã nộp tài liệu chỉnh sửa",
        `Sinh viên ${user.name} đã nộp bộ tài liệu chỉnh sửa cho đề tài "${topic.title}". Vui lòng xem xét và xác nhận.`,
      );
    }

    await writeAuditLog(user.id, "SUBMIT_REVISION_FOR_REVIEW", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã gửi tài liệu chỉnh sửa cho GVHD");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * GVHD đồng ý sinh viên đã hoàn tất chỉnh sửa → chuyển sang chờ Chủ tịch HĐ duyệt.
 */
export async function approveSupervisorRevisionAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.current_status !== "CHO_GVHD_XAC_NHAN") {
      return err("Đề tài không ở trạng thái chờ GVHD xác nhận");
    }

    // Lấy thông tin Chủ tịch HĐ để thông báo
    const committee = await db.committees.findByTopic(topicId);

    await db.topics.update(topicId, {
      current_status: "CHO_CHU_TICH_DUYET",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CHO_GVHD_XAC_NHAN",
      "CHO_CHU_TICH_DUYET",
      user.id,
      "GVHD xác nhận sinh viên đã hoàn tất chỉnh sửa",
    );

    // Thông báo cho sinh viên
    await sendNotification(
      topic.student_id,
      "GVHD đã xác nhận chỉnh sửa",
      `GVHD đã xác nhận bạn đã hoàn tất chỉnh sửa đề tài "${topic.title}". Hồ sơ đang chờ Chủ tịch Hội đồng phê duyệt lần cuối.`,
    );

    // Thông báo cho Chủ tịch HĐ kèm 2 file chỉnh sửa
    if (committee?.chair_id) {
      await sendNotification(
        committee.chair_id,
        "2 file chỉnh sửa chờ Chủ tịch phê duyệt",
        `GVHD đã xác nhận và chuyển 2 file chỉnh sửa của sinh viên (KLTN đã chỉnh sửa + Biên bản giải trình) cho đề tài "${topic.title}". Vui lòng vào trang Hội đồng của tôi để xem và phê duyệt lần cuối.`,
      );
    }

    await writeAuditLog(user.id, "APPROVE_SUPERVISOR_REVISION", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã xác nhận — hồ sơ chuyển sang Chủ tịch HĐ");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * GVHD từ chối — yêu cầu sinh viên chỉnh sửa thêm → quay lại CAN_CHINH_SUA.
 */
export async function rejectSupervisorRevisionAction(
  topicId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.current_status !== "CHO_GVHD_XAC_NHAN") {
      return err("Đề tài không ở trạng thái chờ GVHD xác nhận");
    }

    await db.topics.update(topicId, {
      current_status: "CAN_CHINH_SUA",
      updated_at: nowISO(),
    });

    // Xóa file chỉnh sửa cũ → buộc SV phải upload lại (bắt đầu lại chu trình)
    const oldFiles = await db.files.filter({ topic_id: topicId });
    for (const f of oldFiles) {
      if (f.file_type === "CHINH_SUA" || f.file_type === "PHIEU_GIAI_TRINH") {
        await db.files.delete(f.id, f.file_type).catch(() => { /* silent */ });
      }
    }
    invalidateSheetCache(SHEET_NAMES.FILES_CHINH_SUA);
    invalidateSheetCache(SHEET_NAMES.FILES_GIAI_TRINH);

    await recordStatusChange(
      topicId,
      "CHO_GVHD_XAC_NHAN",
      "CAN_CHINH_SUA",
      user.id,
      note || "GVHD không đồng ý — yêu cầu nộp lại",
    );

    await sendNotification(
      topic.student_id,
      "GVHD không đồng ý — vui lòng upload lại bài",
      `GVHD không đồng ý với bản chỉnh sửa của đề tài "${topic.title}". Lý do: ${note}. File chỉnh sửa cũ đã bị xóa — vui lòng upload lại bộ tài liệu (KLTN đã chỉnh sửa + Biên bản giải trình).`,
    );

    // Gửi email cho SV
    if (isEmailConfigured() && topic.student_id) {
      try {
        const student = (await db.users.findById(topic.student_id)) as Record<string, string> | null;
        if (student?.email) {
          await sendRevisionRejectedEmail({
            to: student.email,
            studentName: student.full_name ?? student.email,
            rejector: "GVHD",
            rejectorName: user.name ?? "",
            topicTitle: topic.title ?? "",
            reason: note,
          });
        }
      } catch (e) {
        console.error(`Lỗi gửi email từ chối chỉnh sửa (GVHD) tới SV ${topic.student_id}:`, e);
      }
    }

    await writeAuditLog(user.id, "REJECT_SUPERVISOR_REVISION", "topics", topicId, { note });
    revalidatePath("/");
    return ok(undefined, "Đã từ chối và yêu cầu chỉnh sửa thêm");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * Chủ tịch HĐ TỪ CHỐI bản chỉnh sửa → quay lại CAN_CHINH_SUA + email SV.
 */
export async function rejectChairRevisionAction(
  topicId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const committee = await db.committees.findByTopic(topicId);
    if (!committee || committee.chair_id !== user.id) {
      return err("Bạn không phải Chủ tịch Hội đồng của đề tài này");
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.current_status !== "CHO_CHU_TICH_DUYET") {
      return err("Đề tài không ở trạng thái chờ Chủ tịch duyệt");
    }

    if (!note?.trim()) {
      return err("Vui lòng nhập lý do từ chối để SV biết cần chỉnh sửa gì");
    }

    await db.topics.update(topicId, {
      current_status: "CAN_CHINH_SUA",
      updated_at: nowISO(),
    });

    // Xóa file chỉnh sửa cũ → buộc SV upload lại
    const oldFiles = await db.files.filter({ topic_id: topicId });
    for (const f of oldFiles) {
      if (f.file_type === "CHINH_SUA" || f.file_type === "PHIEU_GIAI_TRINH") {
        await db.files.delete(f.id, f.file_type).catch(() => { /* silent */ });
      }
    }
    invalidateSheetCache(SHEET_NAMES.FILES_CHINH_SUA);
    invalidateSheetCache(SHEET_NAMES.FILES_GIAI_TRINH);

    await recordStatusChange(
      topicId,
      "CHO_CHU_TICH_DUYET",
      "CAN_CHINH_SUA",
      user.id,
      `Chủ tịch HĐ không đồng ý: ${note}`,
    );

    await sendNotification(
      topic.student_id,
      "Chủ tịch HĐ không đồng ý — vui lòng upload lại bài",
      `Chủ tịch HĐ không đồng ý với bản chỉnh sửa của đề tài "${topic.title}". Lý do: ${note}. File chỉnh sửa cũ đã bị xóa — vui lòng upload lại bộ tài liệu (KLTN đã chỉnh sửa + Biên bản giải trình).`,
    );

    // Notify GVHD luôn để biết SV cần nộp lại từ đầu
    if (topic.supervisor_id) {
      await sendNotification(
        topic.supervisor_id,
        "Chủ tịch HĐ từ chối bản chỉnh sửa",
        `Chủ tịch HĐ đã yêu cầu SV nộp lại bản chỉnh sửa cho đề tài "${topic.title}". SV sẽ upload lại và bạn sẽ duyệt lại từ đầu.`,
      );
    }

    // Email SV
    if (isEmailConfigured() && topic.student_id) {
      try {
        const student = (await db.users.findById(topic.student_id)) as Record<string, string> | null;
        if (student?.email) {
          await sendRevisionRejectedEmail({
            to: student.email,
            studentName: student.full_name ?? student.email,
            rejector: "Chủ tịch HĐ",
            rejectorName: user.name ?? "",
            topicTitle: topic.title ?? "",
            reason: note,
          });
        }
      } catch (e) {
        console.error(`Lỗi gửi email từ chối chỉnh sửa (Chủ tịch) tới SV ${topic.student_id}:`, e);
      }
    }

    await writeAuditLog(user.id, "REJECT_CHAIR_REVISION", "topics", topicId, { note });
    revalidatePath("/");
    return ok(undefined, "Đã từ chối — yêu cầu SV nộp lại bộ tài liệu chỉnh sửa");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * GVHD gửi lại 2 file chỉnh sửa cho Chủ tịch HĐ (khi đã ở CHO_CHU_TICH_DUYET).
 */
export async function resendToChairAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await guardSupervisorAction(topicId);
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.current_status !== "CHO_CHU_TICH_DUYET") {
      return err("Đề tài không ở trạng thái chờ Chủ tịch duyệt");
    }

    const committee = await db.committees.findByTopic(topicId);
    if (!committee?.chair_id) return err("Không tìm thấy Chủ tịch hội đồng");

    await sendNotification(
      committee.chair_id,
      "GVHD gửi 2 file chỉnh sửa — chờ Chủ tịch phê duyệt",
      `GVHD ${user.name} đã gửi lại 2 file chỉnh sửa (KLTN đã chỉnh sửa + Biên bản giải trình) của đề tài "${topic.title}". Vui lòng vào trang Hội đồng của tôi để xem và phê duyệt lần cuối.`,
    );

    revalidatePath("/");
    return ok(undefined, "Đã gửi lại cho Chủ tịch hội đồng");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

/**
 * Chủ tịch HĐ phê duyệt lần cuối → HOAN_TAT.
 */
export async function approveChairFinalAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    // Kiểm tra user là Chủ tịch HĐ của đề tài này
    const committee = await db.committees.findByTopic(topicId);
    if (!committee || committee.chair_id !== user.id) {
      throw new Error("Bạn không phải Chủ tịch Hội đồng của đề tài này");
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    if (topic.current_status !== "CHO_CHU_TICH_DUYET") {
      return err("Đề tài không ở trạng thái chờ Chủ tịch duyệt");
    }

    await db.topics.update(topicId, {
      current_status: "HOAN_TAT",
      updated_at: nowISO(),
    });

    await recordStatusChange(
      topicId,
      "CHO_CHU_TICH_DUYET",
      "HOAN_TAT",
      user.id,
      "Chủ tịch Hội đồng phê duyệt — hoàn tất quy trình",
    );

    // Thông báo sinh viên hoàn tất
    if (topic.student_id) {
      await sendNotification(
        topic.student_id,
        "Quy trình KLTN hoàn tất",
        `Chủ tịch Hội đồng đã phê duyệt bản chỉnh sửa của đề tài "${topic.title}". Quy trình khóa luận tốt nghiệp đã hoàn tất.`,
      );
    }

    await writeAuditLog(user.id, "CHAIR_FINAL_APPROVE", "topics", topicId);
    revalidatePath("/");
    return ok(undefined, "Đã phê duyệt — Hoàn tất quy trình KLTN");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 8. XÓA ĐỀ TÀI (Admin / Trưởng bộ môn)
// ============================================================

export async function deleteTopicAction(topicId: string): Promise<ActionResult> {
  try {
    const user = await requireDean();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    await db.topics.delete(topicId);
    await writeAuditLog(user.id, "DELETE_TOPIC", "topics", topicId, {
      title: topic.title,
    });
    revalidatePath("/dean/topics");
    return ok(undefined, "Đã xóa đề tài");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 9. HỦY ĐĂNG KÝ (Sinh viên hủy đề tài đang chờ)
// ============================================================

export async function cancelTopicRegistrationAction(
  topicId: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");
    if (topic.student_id !== user.id)
      return err("Bạn không có quyền hủy đề tài này");
    if (!["MOI_DANG_KY", "CHO_GVHD_DUYET"].includes(topic.current_status))
      return err("Chỉ có thể hủy đề tài đang chờ xác nhận");

    await db.topics.delete(topicId);
    revalidatePath("/student/status");
    return ok(undefined, "Đã hủy đăng ký đề tài");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10. TRƯỞNG BỘ MÔN TẠO ĐỀ TÀI
// ============================================================

export async function createTopicByDeanAction(data: {
  student_id: string;
  supervisor_id: string;
  title: string;
  field: string;
  topic_type: "KLTN" | "BCTT";
  summary?: string;
}): Promise<ActionResult<{ topicId: string }>> {
  try {
    const user = await requireDean();

    const term = await db.terms.getActive();
    if (!term) return err("Chưa có học kỳ đang hoạt động");

    const student = await db.users.findById(data.student_id);
    if (!student) return err("Không tìm thấy sinh viên");

    const existingTopics = await db.topics.filter({ student_id: data.student_id });
    const hasActive = existingTopics.some((t) =>
      ["MOI_DANG_KY", "CHO_GVHD_DUYET", "DANG_THUC_HIEN"].includes(
        t.current_status,
      ),
    );
    if (hasActive)
      return err("Sinh viên này đã có đề tài đang hoạt động");

    const topicId = generateId();
    const now = nowISO();

    await db.topics.create({
      id: topicId,
      student_id: data.student_id,
      supervisor_id: data.supervisor_id,
      reviewer_id: "",
      title: data.title,
      field: data.field,
      company_name: "",
      topic_type: data.topic_type,
      academic_year: term.academic_year,
      semester: term.semester,
      batch: term.batch,
      summary: data.summary ?? "",
      current_status: "DANG_THUC_HIEN",
      created_at: now,
      updated_at: now,
    });

    await recordStatusChange(topicId, "", "DANG_THUC_HIEN", user.id, "Trưởng bộ môn tạo đề tài");
    await sendNotification(
      data.student_id,
      "Bạn được phân công đề tài",
      `Trưởng bộ môn đã tạo đề tài "${data.title}" cho bạn. Giảng viên hướng dẫn: ${(await db.users.findById(data.supervisor_id))?.full_name ?? "—"}.`,
    );

    await writeAuditLog(user.id, "CREATE_TOPIC_BY_DEAN", "topics", topicId, {
      title: data.title,
    });
    revalidatePath("/dean/topics");
    return ok({ topicId }, "Đã tạo đề tài thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10b. IMPORT HÀNG LOẠT ĐỀ TÀI (TBM)
// ============================================================

export async function bulkCreateTopicsByDeanAction(
  rows: {
    student_code: string;
    supervisor_email: string;
    reviewer_email: string;
    title: string;
    field: string;
    topic_type: "KLTN" | "BCTT";
  }[],
): Promise<ActionResult<{ created: number; errors: string[] }>> {
  try {
    const user = await requireDean();
    const term = await db.terms.getActive();
    if (!term) return err("Chưa có học kỳ đang hoạt động");

    const [allUsers, allTopics] = await Promise.all([
      db.users.getAll() as Promise<Record<string, string>[]>,
      db.topics.getAll() as Promise<Record<string, string>[]>,
    ]);

    const activeStatuses = ["MOI_DANG_KY", "CHO_GVHD_DUYET", "DANG_THUC_HIEN"];
    const now = nowISO();
    const errors: string[] = [];

    // Validate toàn bộ rows trước, gom thành 3 batch để append cùng lúc
    const topicRows: Record<string, string>[] = [];
    const historyRows: Record<string, string>[] = [];
    const notificationRows: Record<string, string>[] = [];
    const seenStudentIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      const student = allUsers.find(
        (u) => u.student_code === row.student_code.trim() && u.system_role === "STUDENT",
      );
      if (!student) {
        errors.push(`Dòng ${rowNum}: Không tìm thấy SV với MSSV "${row.student_code}"`);
        continue;
      }

      const supervisor = allUsers.find(
        (u) => u.email === row.supervisor_email.trim() && ["LECTURER", "DEAN"].includes(u.system_role),
      );
      if (!supervisor) {
        errors.push(`Dòng ${rowNum}: Không tìm thấy GVHD với email "${row.supervisor_email}"`);
        continue;
      }

      let reviewerId = "";
      if (row.reviewer_email?.trim()) {
        const reviewer = allUsers.find(
          (u) => u.email === row.reviewer_email.trim() && ["LECTURER", "DEAN"].includes(u.system_role),
        );
        if (!reviewer) {
          errors.push(`Dòng ${rowNum}: Không tìm thấy GVPB với email "${row.reviewer_email}"`);
          continue;
        }
        reviewerId = reviewer.id;
      }

      // Check active topic (cả dữ liệu cũ và dòng đã xử lý trong batch này)
      const hasActive =
        allTopics.some(
          (t) => t.student_id === student.id && activeStatuses.includes(t.current_status),
        ) || seenStudentIds.has(student.id);
      if (hasActive) {
        errors.push(`Dòng ${rowNum}: SV ${row.student_code} đã có đề tài đang hoạt động`);
        continue;
      }
      seenStudentIds.add(student.id);

      const topicId = generateId();
      topicRows.push({
        id: topicId,
        student_id: student.id,
        supervisor_id: supervisor.id,
        reviewer_id: reviewerId,
        title: row.title.trim(),
        field: row.field.trim(),
        company_name: "",
        topic_type: row.topic_type,
        academic_year: term.academic_year,
        semester: term.semester,
        batch: term.batch,
        summary: "",
        current_status: "DANG_THUC_HIEN",
        created_at: now,
        updated_at: now,
      });

      historyRows.push({
        id: generateId(),
        topic_id: topicId,
        old_status: "",
        new_status: "DANG_THUC_HIEN",
        note: "TBM import hàng loạt",
        changed_by: user.id,
        changed_at: now,
      });

      notificationRows.push({
        id: generateId(),
        user_id: student.id,
        title: "Bạn được phân công đề tài",
        content: `Trưởng bộ môn đã tạo đề tài "${row.title}" cho bạn. GVHD: ${supervisor.full_name ?? "—"}.`,
        is_read: "false",
        created_at: now,
      });
    }

    // Append 3 batch song song — chỉ ~6 API calls tổng cộng bất kể số lượng rows
    await Promise.all([
      sheetAppendMany(SHEET_NAMES.TOPICS, topicRows),
      sheetAppendMany(SHEET_NAMES.TOPIC_STATUS_HISTORIES, historyRows),
      sheetAppendMany(SHEET_NAMES.NOTIFICATIONS, notificationRows),
    ]);

    const created = topicRows.length;

    await writeAuditLog(user.id, "BULK_CREATE_TOPICS", "topics", "", {
      created,
      total: rows.length,
      errorCount: errors.length,
    });
    revalidatePath("/dean/topics");
    return ok({ created, errors });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10a2. GVPB GỬI BIÊN BẢN PHẢN BIỆN CHO THƯ KÝ
// ============================================================

export async function sendBBGVPBToSecretaryAction(
  topicId: string,
): Promise<ActionResult<{ secretaryName: string }>> {
  try {
    const user = await guardReviewerAction(topicId);

    // GVPB phải đã chấm điểm mới được gửi
    const scores = await db.scores.filter({ topic_id: topicId, score_role: "REVIEWER" });
    if (scores.length === 0) {
      return err("Bạn chưa chấm điểm — vui lòng chấm điểm trước khi gửi biên bản");
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) return err("Không tìm thấy đề tài");

    const committee = await db.committees.findByTopic(topicId);
    if (!committee?.secretary_id) {
      return err("Đề tài này chưa có Hội đồng/Thư ký");
    }

    const secretary = await db.users.findById(committee.secretary_id);
    if (!secretary) return err("Không tìm thấy thư ký");

    const student = await db.users.findById(topic.student_id);
    await sendNotification(
      committee.secretary_id,
      "Đã nhận biên bản phản biện",
      `GVPB đã gửi biên bản phản biện cho đề tài "${topic.title}"${
        student ? ` của SV ${student.full_name ?? ""}` : ""
      }. Bạn có thể xem/tải về từ trang tổng hợp điểm.`,
    );

    await writeAuditLog(user.id, "SEND_BB_GVPB_TO_SECRETARY", "topics", topicId, {
      secretary_id: committee.secretary_id,
    });

    return ok({ secretaryName: secretary.full_name ?? secretary.email ?? "" });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10bb. AUTO-PASS GVHD (tự động cho 5 điểm sau khi hết hạn KLTN)
// ============================================================

// Throttle autoPassUngradedGVHD: tránh chạy quá thường xuyên gây quota Sheets API.
// Mỗi page load (/dean/topics, /dean/committees, /dean/committees/[id], /reviewer/dashboard)
// đều gọi hàm này — không throttle thì 60 req/min/user dễ vượt.
let lastAutoPassRunAt = 0;
const AUTO_PASS_COOLDOWN_MS = 5 * 60_000; // 5 phút

/** Hàm nội bộ — tự động cho 5 điểm các đề tài KLTN chưa có điểm GVHD. Gọi từ cron. */
export async function autoPassUngradedGVHD(): Promise<{ passed: number }> {
  // Throttle để không hit Sheets API quota khi nhiều page cùng gọi
  const nowMs = Date.now();
  if (nowMs - lastAutoPassRunAt < AUTO_PASS_COOLDOWN_MS) {
    return { passed: 0 };
  }
  lastAutoPassRunAt = nowMs;

  // An toàn cho consistency: nếu GVHD chấm thật sau auto-pass < 5, submitScoreAction
  // (role=SUPERVISOR) sẽ override status thành KHONG_DAT_HUONG_DAN bất chấp status trước đó.
  const [allTopics, allScores, allUsers] = await Promise.all([
    db.topics.getAll() as Promise<Record<string, string>[]>,
    db.scores.getAll() as Promise<Record<string, string>[]>,
    db.users.getAll() as Promise<Record<string, string>[]>,
  ]);

  const INACTIVE = ["HOAN_TAT", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN", "GVHD_TU_CHOI"];
  const gradedTopicIds = new Set(
    allScores.filter((s) => s.score_role === "SUPERVISOR").map((s) => s.topic_id),
  );

  const candidates = allTopics.filter(
    (t) =>
      t.topic_type === "KLTN" &&
      !INACTIVE.includes(t.current_status) &&
      !gradedTopicIds.has(t.id),
  );

  if (candidates.length === 0) return { passed: 0 };

  const now = nowISO();
  const scoreRows: Record<string, string>[] = [];
  const historyRows: Record<string, string>[] = [];
  const notifRows: Record<string, string>[] = [];
  const topicUpdates: { id: string; next: string }[] = [];

  for (const topic of candidates) {
    const reviewerId = topic.reviewer_id ?? "";
    const nextStatus = reviewerId ? "CHO_CHAM_PHAN_BIEN" : "DA_CHAM_HUONG_DAN";
    const scorerId = topic.supervisor_id ?? "SYSTEM";

    scoreRows.push({
      id: generateId(),
      topic_id: topic.id,
      scorer_id: scorerId,
      score_role: "SUPERVISOR",
      topic_type: topic.topic_type,
      score_value: "5",
      comment: JSON.stringify({ __criteria: {}, __text: "Điểm mặc định (hệ thống tự động)", __cau_hoi: "" }),
      comment_text: "Điểm mặc định (hệ thống tự động)",
      cau_hoi: "",
      created_at: now,
      updated_at: now,
    });

    historyRows.push({
      id: generateId(),
      topic_id: topic.id,
      old_status: topic.current_status,
      new_status: nextStatus,
      note: "Hệ thống tự động pass GVHD (5đ) sau hết hạn",
      changed_by: "SYSTEM",
      changed_at: now,
    });

    notifRows.push({
      id: generateId(),
      user_id: topic.student_id,
      title: "GVHD đã chấm điểm — Đạt yêu cầu",
      content: `Khóa luận của bạn đã được chấm đạt yêu cầu. ${reviewerId ? "GVPB sẽ tiếp tục chấm điểm." : "Đang chờ phân công giảng viên phản biện."}`,
      is_read: "false",
      created_at: now,
    });

    if (reviewerId) {
      const reviewer = allUsers.find((u) => u.id === reviewerId);
      if (reviewer) {
        notifRows.push({
          id: generateId(),
          user_id: reviewerId,
          title: "Đến lượt bạn chấm phản biện",
          content: `GVHD đã hoàn tất chấm điểm đề tài "${topic.title}". Bạn có thể vào hệ thống để chấm phản biện.`,
          is_read: "false",
          created_at: now,
        });
      }
    }

    topicUpdates.push({ id: topic.id, next: nextStatus });
  }

  await Promise.all([
    sheetAppendMany(SHEET_NAMES.SCORES, scoreRows),
    sheetAppendMany(SHEET_NAMES.TOPIC_STATUS_HISTORIES, historyRows),
    sheetAppendMany(SHEET_NAMES.NOTIFICATIONS, notifRows),
    sheetBatchRangeUpdate(
      SHEET_NAMES.TOPICS,
      topicUpdates.map((t) => ({
        id: t.id,
        data: { current_status: t.next, updated_at: now },
      })),
    ),
  ]);

  await writeAuditLog("SYSTEM", "AUTO_PASS_GVHD", "topics", "", {
    passed: candidates.length,
  });

  return { passed: candidates.length };
}

// ============================================================
// 10bc. FIX MISMATCH STATUS: GVPB <5 nhưng status chưa phải KHONG_DAT_PHAN_BIEN
// ============================================================

/** Quét toàn bộ đề tài, set KHONG_DAT_PHAN_BIEN cho các đề tài GVPB chấm <5
 *  nhưng status còn đang ở DA_CHAM_PHAN_BIEN / CHO_HOI_DONG / DANG_CHAM_HOI_DONG.
 *  Không đụng các status sau hội đồng (CAN_CHINH_SUA, HOAN_TAT, v.v.). */
export async function fixGvpbStatusMismatchAction(): Promise<
  ActionResult<{ fixed: number; details: string[] }>
> {
  try {
    const user = await requireAuth();
    if (user.system_role !== "ADMIN") return err("Chỉ ADMIN mới thực hiện được");

    const [allTopics, allScores] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.scores.getAll() as Promise<Record<string, string>[]>,
    ]);

    // Lấy điểm GVPB mới nhất cho mỗi topic
    const pbScoreByTopic = new Map<string, number>();
    for (const s of allScores) {
      if (s.score_role !== "REVIEWER") continue;
      const v = parseFloat(s.score_value);
      if (!Number.isFinite(v)) continue;
      const existing = pbScoreByTopic.get(s.topic_id);
      if (existing === undefined) pbScoreByTopic.set(s.topic_id, v);
      else pbScoreByTopic.set(s.topic_id, v); // ghi đè bằng điểm sau (giả định sheet append cuối cùng là mới nhất)
    }

    const FIXABLE_STATUS = new Set([
      "DA_CHAM_PHAN_BIEN",
      "CHO_HOI_DONG",
      "DANG_CHAM_HOI_DONG",
    ]);

    const details: string[] = [];
    const now = nowISO();
    const topicUpdates: { id: string; data: Record<string, string> }[] = [];
    const historyRows: Record<string, string>[] = [];

    for (const t of allTopics) {
      const pb = pbScoreByTopic.get(t.id);
      if (pb === undefined || pb >= PASSING_SCORE) continue;
      if (!FIXABLE_STATUS.has(t.current_status)) continue;
      topicUpdates.push({
        id: t.id,
        data: { current_status: "KHONG_DAT_PHAN_BIEN", updated_at: now },
      });
      historyRows.push({
        id: generateId(),
        topic_id: t.id,
        old_status: t.current_status,
        new_status: "KHONG_DAT_PHAN_BIEN",
        note: `Admin fix lệch status: GVPB ${pb} < ${PASSING_SCORE}`,
        changed_by: user.id,
        changed_at: now,
      });
      details.push(
        `${(t.title ?? "").slice(0, 60)} — ${t.current_status} → KHONG_DAT_PHAN_BIEN (pb=${pb})`,
      );
    }

    // Batch: 1 read + 1 batchUpdate cho topics, 1 read + 1 append cho histories
    if (topicUpdates.length > 0) {
      await Promise.all([
        sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, topicUpdates),
        sheetAppendMany(SHEET_NAMES.TOPIC_STATUS_HISTORIES, historyRows),
      ]);
    }

    await writeAuditLog(user.id, "FIX_GVPB_STATUS_MISMATCH", "topics", "", {
      fixed: details.length,
    });
    revalidatePath("/");
    return ok(
      { fixed: details.length, details },
      details.length > 0 ? `Đã sửa ${details.length} đề tài` : "Không có đề tài nào cần sửa",
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10bd. FIX MISMATCH: đề tài đã trong HĐ nhưng status lùi về pha phản biện
// ============================================================

/** Quét toàn bộ đề tài đã có trong committee_assignments. Nếu status lệch
 *  (DA_CHAM_PHAN_BIEN / CHO_CHAM_PHAN_BIEN / DA_CHAM_HUONG_DAN) thì đẩy
 *  lại về CHO_HOI_DONG. Không đụng các đề tài đã ở pha sau (DANG_CHAM_HOI_DONG,
 *  CAN_CHINH_SUA, HOAN_TAT, ...) hoặc fail thật (KHONG_DAT_*). */
export async function fixCommitteeStatusMismatchAction(): Promise<
  ActionResult<{ fixed: number; details: string[] }>
> {
  try {
    const user = await requireAuth();
    if (user.system_role !== "ADMIN") return err("Chỉ ADMIN mới thực hiện được");

    const [allTopics, allAssignments] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.committeeTopics.getAll() as Promise<Record<string, string>[]>,
    ]);

    const inCommittee = new Set(allAssignments.map((a) => a.topic_id));
    const FIXABLE = new Set(["DA_CHAM_PHAN_BIEN", "CHO_CHAM_PHAN_BIEN", "DA_CHAM_HUONG_DAN"]);

    const details: string[] = [];
    const now = nowISO();
    const topicUpdates: { id: string; data: Record<string, string> }[] = [];
    const historyRows: Record<string, string>[] = [];

    for (const t of allTopics) {
      if (!inCommittee.has(t.id)) continue;
      if (!FIXABLE.has(t.current_status)) continue;
      topicUpdates.push({
        id: t.id,
        data: { current_status: "CHO_HOI_DONG", updated_at: now },
      });
      historyRows.push({
        id: generateId(),
        topic_id: t.id,
        old_status: t.current_status,
        new_status: "CHO_HOI_DONG",
        note: `Admin fix lệch status: đề tài đã trong HĐ nhưng status còn ở ${t.current_status}`,
        changed_by: user.id,
        changed_at: now,
      });
      details.push(
        `${(t.title ?? "").slice(0, 60)} — ${t.current_status} → CHO_HOI_DONG`,
      );
    }

    // Batch: 1 read + 1 batchUpdate cho topics, 1 read + 1 append cho histories
    if (topicUpdates.length > 0) {
      await Promise.all([
        sheetBatchRangeUpdate(SHEET_NAMES.TOPICS, topicUpdates),
        sheetAppendMany(SHEET_NAMES.TOPIC_STATUS_HISTORIES, historyRows),
      ]);
    }

    await writeAuditLog(user.id, "FIX_COMMITTEE_STATUS_MISMATCH", "topics", "", {
      fixed: details.length,
    });
    revalidatePath("/");
    return ok(
      { fixed: details.length, details },
      details.length > 0 ? `Đã sửa ${details.length} đề tài` : "Không có đề tài nào cần sửa",
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 10c. IMPORT HÀNG LOẠT LINK FILE (TBM)
// ============================================================

/** Parse Google Drive URL → extract fileId. Support nhiều dạng URL. */
function extractDriveFileId(url: string): string {
  const clean = url.trim();
  if (!clean) return "";
  // https://drive.google.com/file/d/{id}/view
  const m1 = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  // https://drive.google.com/open?id={id} hoặc uc?id={id}
  const m2 = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  // https://docs.google.com/.../d/{id}/...
  const m3 = clean.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return clean; // Giả định đây là fileId thuần
}

export async function bulkImportFilesByDeanAction(
  rows: {
    student_code: string;
    kltn_url: string;
    turnitin_url: string;
  }[],
): Promise<ActionResult<{ created: number; errors: string[] }>> {
  try {
    const user = await requireDean();

    const [allUsers, allTopics] = await Promise.all([
      db.users.getAll() as Promise<Record<string, string>[]>,
      db.topics.getAll() as Promise<Record<string, string>[]>,
    ]);

    const inactiveStatuses = ["HOAN_TAT", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN", "GVHD_TU_CHOI"];
    const now = nowISO();
    const errors: string[] = [];
    const kltnFileRows: Record<string, string>[] = [];
    const turnitinFileRows: Record<string, string>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const code = row.student_code.trim();
      const kltnUrl = row.kltn_url.trim();
      const turnitinUrl = row.turnitin_url.trim();

      if (!code) {
        errors.push(`Dòng ${rowNum}: Thiếu MSSV`);
        continue;
      }
      if (!kltnUrl && !turnitinUrl) {
        errors.push(`Dòng ${rowNum}: Không có link file nào`);
        continue;
      }

      const student = allUsers.find(
        (u) => u.student_code === code && u.system_role === "STUDENT",
      );
      if (!student) {
        errors.push(`Dòng ${rowNum}: Không tìm thấy SV với MSSV "${code}"`);
        continue;
      }

      // Tìm đề tài KLTN đang hoạt động của SV
      const topic = allTopics.find(
        (t) =>
          t.student_id === student.id &&
          t.topic_type === "KLTN" &&
          !inactiveStatuses.includes(t.current_status),
      );
      if (!topic) {
        errors.push(`Dòng ${rowNum}: SV ${code} không có đề tài KLTN đang hoạt động`);
        continue;
      }

      if (kltnUrl) {
        const fileId = extractDriveFileId(kltnUrl);
        kltnFileRows.push({
          id: generateId(),
          topic_id: topic.id,
          uploaded_by: user.id,
          file_type: "KHOA_LUAN",
          original_name: `KLTN-${code}.pdf`,
          stored_name: fileId,
          file_url: kltnUrl,
          mime_type: "application/pdf",
          file_size: "0",
          uploaded_at: now,
        });
      }

      if (turnitinUrl) {
        const fileId = extractDriveFileId(turnitinUrl);
        turnitinFileRows.push({
          id: generateId(),
          topic_id: topic.id,
          uploaded_by: user.id,
          file_type: "TURNITIN",
          original_name: `Turnitin-${code}.pdf`,
          stored_name: fileId,
          file_url: turnitinUrl,
          mime_type: "application/pdf",
          file_size: "0",
          uploaded_at: now,
        });
      }
    }

    await Promise.all([
      sheetAppendMany(SHEET_NAMES.FILES_KHOA_LUAN, kltnFileRows),
      sheetAppendMany(SHEET_NAMES.FILES_TURNITIN, turnitinFileRows),
    ]);

    const created = kltnFileRows.length + turnitinFileRows.length;

    await writeAuditLog(user.id, "BULK_IMPORT_FILES", "files", "", {
      kltnCount: kltnFileRows.length,
      turnitinCount: turnitinFileRows.length,
      errorCount: errors.length,
    });
    revalidatePath("/dean/topics");
    return ok({ created, errors });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// 11. LẤY ĐIỂM TỔNG HỢP
// ============================================================

export async function getScoreSummaryAction(topicId: string) {
  try {
    const user = await requireAuth();

    const scores = await db.scores.filter({ topic_id: topicId });
    const isSecretary =
      (await db.committees.findByTopic(topicId))?.secretary_id === user.id;

    const supervisorScore = scores.find((s) => s.score_role === "SUPERVISOR");
    const reviewerScore = scores.find((s) => s.score_role === "REVIEWER");
    const committeeScores = scores.filter(
      (s) => s.score_role === "COMMITTEE_MEMBER",
    );

    let totalScore: number | null = null;
    if (isSecretary) {
      const svScore = supervisorScore
        ? Number(supervisorScore.score_value)
        : undefined;
      const rvScore = reviewerScore
        ? Number(reviewerScore.score_value)
        : undefined;
      const cmScores = committeeScores.map((s) => Number(s.score_value));
      totalScore = calculateTotalScore(svScore, rvScore, cmScores);
    }

    return ok({
      supervisorScore: supervisorScore
        ? Number(supervisorScore.score_value)
        : null,
      supervisorComment: supervisorScore?.comment ?? null,
      reviewerScore: reviewerScore ? Number(reviewerScore.score_value) : null,
      reviewerComment: reviewerScore?.comment ?? null,
      committeeScores: committeeScores.map((s) => ({
        scorerId: s.scorer_id,
        score: Number(s.score_value),
        comment: s.comment,
      })),
      totalScore,
      isSecretary,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// Bulk advance: chuyển tất cả đề tài còn ở pha HĐ → CAN_CHINH_SUA
// Dùng khi tất cả buổi bảo vệ đã xong, TBM muốn mở cho SV nộp file chỉnh sửa.
// ============================================================
export async function bulkAdvanceToCanChinhSuaAction(): Promise<
  ActionResult<{ updated: number; titles: string[] }>
> {
  try {
    const user = await requireDean();

    const allTopics = (await db.topics.getAll()) as Record<string, string>[];
    const allAssignments = (await db.committeeTopics.getAll()) as Record<string, string>[];
    const assignedTopicIds = new Set(allAssignments.map((a) => a.topic_id));

    // Trạng thái pha HĐ (chưa đến CAN_CHINH_SUA) — TBM muốn forward
    const POST_DEFENSE_PENDING = [
      "CHO_HOI_DONG",
      "DANG_CHAM_HOI_DONG",
      "DA_CHAM_PHAN_BIEN",
      "DA_CHAM_HUONG_DAN", // auto-pass case, đã có HĐ
    ];

    const candidates = allTopics.filter(
      (t) =>
        t.topic_type === "KLTN" &&
        assignedTopicIds.has(t.id) &&
        POST_DEFENSE_PENDING.includes(t.current_status),
    );

    if (candidates.length === 0) {
      return ok({ updated: 0, titles: [] }, "Không có đề tài nào cần chuyển trạng thái");
    }

    const titles: string[] = [];
    for (const topic of candidates) {
      await db.topics.update(topic.id, {
        current_status: "CAN_CHINH_SUA",
        updated_at: nowISO(),
      });
      await recordStatusChange(
        topic.id,
        topic.current_status,
        "CAN_CHINH_SUA",
        user.id,
        "TBM mở cho SV nộp file chỉnh sửa sau bảo vệ (bulk)",
      );
      // Notify SV
      if (topic.student_id) {
        await sendNotification(
          topic.student_id,
          "Mở nộp bài chỉnh sửa sau bảo vệ",
          `Hội đồng đã hoàn tất bảo vệ khóa luận "${topic.title}". Vui lòng vào hệ thống nộp file chỉnh sửa + biên bản giải trình theo yêu cầu của HĐ.`,
        );
      }
      titles.push(topic.title ?? "(không tên)");
    }

    await writeAuditLog(user.id, "BULK_ADVANCE_CHINH_SUA", "topics", "bulk", {
      count: candidates.length,
    });

    revalidatePath("/dean/post-defense");
    revalidatePath("/student/status");

    return ok({ updated: candidates.length, titles }, `Đã chuyển ${candidates.length} đề tài sang CAN_CHINH_SUA`);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}
