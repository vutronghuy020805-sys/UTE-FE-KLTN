"use server";

import { db } from "@/lib/sheets/client";
import { requireDean } from "@/lib/permissions";
import { nowISO, ok, err } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { isEmailConfigured, sendRevisionReviewReminderEmail } from "@/lib/email";

export interface ReminderInput {
  title: string;
  content: string;
  deadline_date: string;       // YYYY-MM-DD
  reminder_dates: string;      // "YYYY-MM-DD,YYYY-MM-DD,..."
  email_list: string;          // "a@gmail.com,b@gmail.com,..."
}

async function authDean() {
  return requireDean();
}

export async function getRemindersAction() {
  try {
    await authDean();
    const all = await db.reminders.getAll();
    all.sort((a, b) =>
      (b as Record<string, string>).created_at?.localeCompare(
        (a as Record<string, string>).created_at ?? "",
      ) ?? 0,
    );
    return ok(all as Record<string, string>[]);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export async function createReminderAction(input: ReminderInput) {
  try {
    const user = await authDean();
    await db.reminders.create({
      id: uuidv4(),
      title: input.title.trim(),
      content: input.content.trim(),
      deadline_date: input.deadline_date,
      reminder_dates: input.reminder_dates.trim(),
      email_list: input.email_list.trim(),
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export async function updateReminderAction(id: string, input: ReminderInput) {
  try {
    await authDean();
    await db.reminders.update(id, {
      title: input.title.trim(),
      content: input.content.trim(),
      deadline_date: input.deadline_date,
      reminder_dates: input.reminder_dates.trim(),
      email_list: input.email_list.trim(),
      updated_at: nowISO(),
    });
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/** TBM cập nhật hạn nộp của học kỳ active */
export async function updateActiveTermDeadlinesAction(kltn_deadline: string, bctt_deadline: string) {
  try {
    await authDean();
    const term = await db.terms.getActive();
    if (!term?.id) return err("Không có học kỳ nào đang active");
    await db.terms.update(term.id, {
      kltn_deadline: kltn_deadline || term.kltn_deadline,
      bctt_deadline: bctt_deadline || term.bctt_deadline,
      updated_at: nowISO(),
    });
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return toYMD(d);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

const INACTIVE_STATUSES = ["HOAN_TAT", "KHONG_DAT_HUONG_DAN", "KHONG_DAT_PHAN_BIEN", "GVHD_TU_CHOI"];

/** Nhắc GVHD chưa chấm điểm hướng dẫn: 1 ngày trước hạn KLTN */
export async function createAutoGVHDReminderAction() {
  try {
    const user = await authDean();
    const [term, topics, scores, allUsers] = await Promise.all([
      db.terms.getActive(),
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.scores.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
    ]);
    if (!term?.kltn_deadline) return err("Học kỳ hiện tại chưa có hạn nộp KLTN");

    const reminderDate = subtractDays(term.kltn_deadline, 1);

    const gradedTopicIds = new Set(
      scores.filter((s) => s.score_role === "SUPERVISOR").map((s) => s.topic_id),
    );
    const ungradedSupIds = [...new Set(
      topics
        .filter((t) => !INACTIVE_STATUSES.includes(t.current_status) && t.supervisor_id && !gradedTopicIds.has(t.id))
        .map((t) => t.supervisor_id),
    )];
    if (ungradedSupIds.length === 0) return err("Tất cả GVHD đã chấm điểm hoặc không có đề tài nào cần chấm");

    const emails = ungradedSupIds
      .map((id) => allUsers.find((u) => u.id === id)?.email)
      .filter(Boolean)
      .join(", ");

    await db.reminders.create({
      id: uuidv4(),
      title: "Nhắc GVHD chấm điểm hướng dẫn KLTN",
      content: `Kính gửi quý thầy/cô, vui lòng hoàn thành chấm điểm hướng dẫn cho sinh viên trước hạn KLTN.`,
      deadline_date: term.kltn_deadline,
      reminder_dates: reminderDate,
      email_list: emails,
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    return ok({ emailCount: ungradedSupIds.length, reminderDate });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/** Nhắc GVPB chưa chấm điểm phản biện: 2 ngày trước ngày Hội đồng */
export async function createAutoGVPBReminderAction(councilDate: string) {
  try {
    const user = await authDean();
    if (!councilDate) return err("Vui lòng chọn ngày Hội đồng");

    const [topics, scores, allUsers] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.scores.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
    ]);

    const reminderDate = subtractDays(councilDate, 2);

    const gradedTopicIds = new Set(
      scores.filter((s) => s.score_role === "REVIEWER").map((s) => s.topic_id),
    );
    const ungradedRevIds = [...new Set(
      topics
        .filter((t) => !INACTIVE_STATUSES.includes(t.current_status) && t.reviewer_id && !gradedTopicIds.has(t.id))
        .map((t) => t.reviewer_id),
    )];
    if (ungradedRevIds.length === 0) return err("Tất cả GVPB đã chấm điểm hoặc không có đề tài nào cần chấm");

    const emails = ungradedRevIds
      .map((id) => allUsers.find((u) => u.id === id)?.email)
      .filter(Boolean)
      .join(", ");

    await db.reminders.create({
      id: uuidv4(),
      title: "Nhắc GVPB chấm điểm phản biện",
      content: `Kính gửi quý thầy/cô, vui lòng hoàn thành chấm điểm phản biện trước ngày Hội đồng.`,
      deadline_date: councilDate,
      reminder_dates: reminderDate,
      email_list: emails,
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    return ok({ emailCount: ungradedRevIds.length, reminderDate });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/** Nhắc thành viên Hội đồng: 1 ngày trước ngày Hội đồng */
export async function createAutoHDReminderAction(councilDate: string) {
  try {
    const user = await authDean();
    if (!councilDate) return err("Vui lòng chọn ngày Hội đồng");

    const reminderDate = subtractDays(councilDate, 1);

    const memberIds = await db.committees.getMemberIdsByDate(councilDate);
    if (memberIds.size === 0) return err("Không có Hội đồng nào được xếp lịch vào ngày này");

    const allUsers = (await db.users.getAll()) as Record<string, string>[];
    const emails = [...memberIds]
      .map((id) => allUsers.find((u) => u.id === id)?.email)
      .filter(Boolean)
      .join(", ");

    await db.reminders.create({
      id: uuidv4(),
      title: `Nhắc thành viên Hội đồng ngày ${councilDate}`,
      content: `Kính gửi quý thầy/cô, bạn có lịch tham gia Hội đồng bảo vệ KLTN vào ngày ${councilDate}. Vui lòng chuẩn bị đầy đủ.`,
      deadline_date: councilDate,
      reminder_dates: reminderDate,
      email_list: emails,
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    return ok({ emailCount: memberIds.size, reminderDate });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/** Thông báo SV đã đăng ký BCTT: 1 ngày sau hạn BCTT */
export async function createAutoBCTTReminderAction() {
  try {
    const user = await authDean();
    const [term, topics, allUsers] = await Promise.all([
      db.terms.getActive(),
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
    ]);
    if (!term?.bctt_deadline) return err("Học kỳ hiện tại chưa có hạn BCTT");

    const reminderDate = addDays(term.bctt_deadline, 1);

    const bcttStudentIds = topics
      .filter((t) => t.topic_type === "BCTT" && t.student_id)
      .map((t) => t.student_id);
    if (bcttStudentIds.length === 0) return err("Không có sinh viên nào đăng ký BCTT");

    const emails = bcttStudentIds
      .map((id) => allUsers.find((u) => u.id === id)?.email)
      .filter(Boolean)
      .join(", ");

    await db.reminders.create({
      id: uuidv4(),
      title: "Thông báo sinh viên đăng ký BCTT",
      content: `Thân gửi bạn, bạn đã đăng ký Báo cáo tổng tiến (BCTT). Vui lòng đăng nhập vào hệ thống để theo dõi tiến độ và hoàn tất các bước cần thiết.`,
      deadline_date: term.bctt_deadline,
      reminder_dates: reminderDate,
      email_list: emails,
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    return ok({ emailCount: bcttStudentIds.length, reminderDate });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export type ComposeRecipientGroup =
  | "GVHD_HD"
  | "GVPB_PB"
  | "HD_MEMBER"
  | "BCTT_SV"
  | "REVISION_GVHD"
  | "CHAIR_FINAL";

export interface ComposeReminderInput {
  recipientGroups: ComposeRecipientGroup[];
  councilDate?: string;
  title: string;
  content: string;
  remindBeforeDate?: string;
  remindOnDate?: string;
}

/** Tạo 1 nhắc hạn từ form compose (multi-group recipient + 2 ngày nhắc). */
export async function createComposeReminderAction(input: ComposeReminderInput) {
  try {
    const user = await authDean();

    const groups = [...new Set(input.recipientGroups ?? [])];
    if (groups.length === 0) return err("Vui lòng chọn ít nhất 1 đối tượng");
    if (!input.title?.trim()) return err("Vui lòng nhập tiêu đề");
    if (!input.content?.trim()) return err("Vui lòng nhập nội dung");

    const remindBefore = input.remindBeforeDate?.trim() || "";
    const remindOn = input.remindOnDate?.trim() || "";
    if (!remindBefore && !remindOn) return err("Vui lòng chọn ít nhất 1 ngày nhắc");

    if (groups.includes("HD_MEMBER") && !input.councilDate?.trim()) {
      return err("Cần chọn 'Ngày Hội đồng' khi gửi cho thành viên Hội đồng");
    }

    const [topics, scores, allUsers, committeeTopics, committees] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.scores.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
      db.committeeTopics.getAll() as Promise<Record<string, string>[]>,
      db.committees.getAll() as Promise<Record<string, string>[]>,
    ]);

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const activeTopics = topics.filter((t) => !INACTIVE_STATUSES.includes(t.current_status));
    const emailSet = new Set<string>();

    const addEmailById = (userId?: string) => {
      if (!userId) return;
      const e = userMap.get(userId)?.email?.trim();
      if (e) emailSet.add(e);
    };

    for (const group of groups) {
      if (group === "GVHD_HD") {
        const gradedTopicIds = new Set(
          scores.filter((s) => s.score_role === "SUPERVISOR").map((s) => s.topic_id),
        );
        const ids = new Set<string>();
        for (const t of activeTopics) {
          if (t.supervisor_id && !gradedTopicIds.has(t.id)) ids.add(t.supervisor_id);
        }
        ids.forEach(addEmailById);
      } else if (group === "GVPB_PB") {
        const gradedTopicIds = new Set(
          scores.filter((s) => s.score_role === "REVIEWER").map((s) => s.topic_id),
        );
        const ids = new Set<string>();
        for (const t of activeTopics) {
          if (t.reviewer_id && !gradedTopicIds.has(t.id)) ids.add(t.reviewer_id);
        }
        ids.forEach(addEmailById);
      } else if (group === "HD_MEMBER") {
        const memberIds = await db.committees.getMemberIdsByDate(input.councilDate!);
        memberIds.forEach(addEmailById);
      } else if (group === "BCTT_SV") {
        for (const t of topics) {
          if (t.topic_type === "BCTT" && t.student_id) addEmailById(t.student_id);
        }
      } else if (group === "REVISION_GVHD") {
        for (const t of topics) {
          if (
            t.current_status === "CHO_GVHD_XAC_NHAN" &&
            t.topic_type !== "BCTT" &&
            t.supervisor_id
          ) {
            addEmailById(t.supervisor_id);
          }
        }
      } else if (group === "CHAIR_FINAL") {
        const committeeMap = new Map(committees.map((c) => [c.id, c]));
        for (const t of topics) {
          if (t.current_status !== "CHO_CHU_TICH_DUYET" || t.topic_type === "BCTT") continue;
          const assignment = committeeTopics.find((a) => a.topic_id === t.id);
          const chairId = assignment ? committeeMap.get(assignment.committee_id)?.chair_id : undefined;
          if (chairId) addEmailById(chairId);
        }
      }
    }

    if (emailSet.size === 0) return err("Không tìm thấy email phù hợp với đối tượng đã chọn");

    const reminderDates = [remindBefore, remindOn].filter(Boolean).join(",");
    const deadlineDate = remindOn || remindBefore;

    await db.reminders.create({
      id: uuidv4(),
      title: input.title.trim(),
      content: input.content.trim(),
      deadline_date: deadlineDate,
      reminder_dates: reminderDates,
      email_list: [...emailSet].join(", "),
      sent_dates: "",
      created_by: user.id,
      created_at: nowISO(),
      updated_at: nowISO(),
    });

    return ok({ emailCount: emailSet.size, groups: groups.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export async function deleteReminderAction(id: string) {
  try {
    await authDean();
    await db.reminders.delete(id);
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/**
 * Gửi mail nhắc GVHD vào duyệt 2 file chỉnh sửa sau bảo vệ.
 * Lọc topics có status CHO_GVHD_XAC_NHAN, group theo GVHD,
 * mỗi GVHD nhận 1 email với danh sách đề tài đang chờ duyệt.
 */
export async function sendPostDefenseRevisionReminderAction() {
  try {
    await authDean();
    if (!isEmailConfigured()) return err("SMTP chưa được cấu hình (SMTP_USER, SMTP_PASS)");

    const [topics, allUsers] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
    ]);

    const pending = topics.filter(
      (t) =>
        t.current_status === "CHO_GVHD_XAC_NHAN" &&
        t.topic_type !== "BCTT" &&
        t.supervisor_id,
    );
    if (pending.length === 0) {
      return err("Không có đề tài nào đang chờ GVHD duyệt chỉnh sửa");
    }

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const groups = new Map<string, typeof pending>();
    for (const t of pending) {
      if (!groups.has(t.supervisor_id)) groups.set(t.supervisor_id, []);
      groups.get(t.supervisor_id)!.push(t);
    }

    let sentCount = 0;
    const failed: string[] = [];

    for (const [supId, sTopics] of groups) {
      const sup = userMap.get(supId);
      if (!sup?.email) {
        failed.push(`${sup?.full_name ?? supId} (không có email)`);
        continue;
      }
      const topicSummaries = sTopics.map((t) => {
        const sv = userMap.get(t.student_id);
        return {
          title: t.title ?? "—",
          studentName: sv?.full_name ?? "—",
          studentCode: sv?.student_code ?? "—",
        };
      });
      try {
        await sendRevisionReviewReminderEmail({
          to: sup.email,
          recipientName: sup.full_name ?? sup.email,
          topics: topicSummaries,
          role: "GVHD",
        });
        sentCount++;
      } catch (e) {
        failed.push(`${sup.full_name}: ${e instanceof Error ? e.message : "lỗi gửi"}`);
      }
    }

    return ok({
      sentCount,
      totalGVHD: groups.size,
      totalTopics: pending.length,
      failed,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

/**
 * Gửi mail nhắc Chủ tịch Hội đồng phê duyệt 2 file chỉnh sửa cuối cùng.
 * Lọc topics có status CHO_CHU_TICH_DUYET, tìm chair_id qua committeeTopics + committees,
 * group theo chair, mỗi chair nhận 1 email tổng hợp.
 */
export async function sendPostDefenseChairReminderAction() {
  try {
    await authDean();
    if (!isEmailConfigured()) return err("SMTP chưa được cấu hình (SMTP_USER, SMTP_PASS)");

    const [topics, allUsers, committeeTopics, committees] = await Promise.all([
      db.topics.getAll() as Promise<Record<string, string>[]>,
      db.users.getAll() as Promise<Record<string, string>[]>,
      db.committeeTopics.getAll() as Promise<Record<string, string>[]>,
      db.committees.getAll() as Promise<Record<string, string>[]>,
    ]);

    const pending = topics.filter(
      (t) =>
        t.current_status === "CHO_CHU_TICH_DUYET" &&
        t.topic_type !== "BCTT",
    );
    if (pending.length === 0) {
      return err("Không có đề tài nào đang chờ Chủ tịch HĐ phê duyệt");
    }

    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const committeeMap = new Map(committees.map((c) => [c.id, c]));

    const groups = new Map<string, typeof pending>();
    for (const t of pending) {
      const assignment = committeeTopics.find((a) => a.topic_id === t.id);
      const committee = assignment ? committeeMap.get(assignment.committee_id) : null;
      const chairId = committee?.chair_id;
      if (!chairId) continue;
      if (!groups.has(chairId)) groups.set(chairId, []);
      groups.get(chairId)!.push(t);
    }

    if (groups.size === 0) {
      return err("Không tìm thấy Chủ tịch HĐ cho các đề tài đang chờ duyệt");
    }

    let sentCount = 0;
    const failed: string[] = [];

    for (const [chairId, sTopics] of groups) {
      const chair = userMap.get(chairId);
      if (!chair?.email) {
        failed.push(`${chair?.full_name ?? chairId} (không có email)`);
        continue;
      }
      const topicSummaries = sTopics.map((t) => {
        const sv = userMap.get(t.student_id);
        return {
          title: t.title ?? "—",
          studentName: sv?.full_name ?? "—",
          studentCode: sv?.student_code ?? "—",
        };
      });
      try {
        await sendRevisionReviewReminderEmail({
          to: chair.email,
          recipientName: chair.full_name ?? chair.email,
          topics: topicSummaries,
          role: "CHAIR",
        });
        sentCount++;
      } catch (e) {
        failed.push(`${chair.full_name}: ${e instanceof Error ? e.message : "lỗi gửi"}`);
      }
    }

    return ok({
      sentCount,
      totalChair: groups.size,
      totalTopics: pending.length,
      failed,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}
