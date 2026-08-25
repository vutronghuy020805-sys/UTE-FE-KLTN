"use server";

import { db } from "@/lib/sheets/client";
import { sendGenericEmail, isEmailConfigured } from "@/lib/email";
import { nowISO, ok, err } from "@/lib/utils";
import { requireDean } from "@/lib/permissions";
import { autoPassUngradedGVHD } from "@/app/actions/topic.actions";

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function runDeadlineReminder() {
  const log: string[] = [];
  let emailsSent = 0;
  let skipped = 0;

  const today = todayStr();

  // Auto-pass GVHD: luôn chạy khi cron kích hoạt
  try {
    const result = await autoPassUngradedGVHD();
    if (result.passed > 0) {
      log.push(`▶ Auto-pass GVHD: ${result.passed} đề tài được cho 5đ tự động`);
    }
  } catch (e) {
    log.push(`✗ Lỗi auto-pass GVHD: ${String(e)}`);
  }

  const reminders = (await db.reminders.getAll()) as Record<string, string>[];

  for (const reminder of reminders) {
    const { id, title, content, deadline_date, reminder_dates, email_list, sent_dates } = reminder;
    if (!deadline_date || !reminder_dates || !email_list) continue;

    // Kiểm tra hôm nay có nằm trong reminder_dates không
    const scheduledDates = reminder_dates.split(",").map((d) => d.trim()).filter(Boolean);
    if (!scheduledDates.includes(today)) continue;

    // Kiểm tra đã gửi hôm nay chưa (dedup)
    const alreadySentDates = (sent_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);
    if (alreadySentDates.includes(today)) {
      log.push(`SKIP "${title}" (đã gửi ${today})`);
      skipped++;
      continue;
    }

    const daysLeft = daysUntil(deadline_date);
    const emails = email_list.split(",").map((e) => e.trim()).filter(Boolean);
    const deadlineFormatted = formatDate(deadline_date);

    log.push(`▶ "${title}" → ${emails.length} email (còn ${daysLeft} ngày)`);

    let sentCount = 0;
    if (isEmailConfigured()) {
      for (const email of emails) {
        try {
          await sendGenericEmail({
            to: email,
            subject: `[KLTN] Nhắc nhở: ${title} – còn ${daysLeft} ngày`,
            title,
            content: content || `Hạn nộp "${title}" là ngày ${deadlineFormatted}, còn ${daysLeft} ngày. Vui lòng hoàn thành đúng hạn.`,
            deadlineFormatted,
            daysLeft,
          });
          sentCount++;
          emailsSent++;
        } catch (e) {
          log.push(`  ✗ Lỗi gửi ${email}: ${String(e)}`);
        }
      }
      log.push(`  ✓ Gửi thành công ${sentCount}/${emails.length} email`);
    } else {
      log.push(`  → SMTP chưa cấu hình, bỏ qua gửi email`);
    }

    // Cập nhật sent_dates
    const newSentDates = [...alreadySentDates, today].join(",");
    await db.reminders.update(id, {
      sent_dates: newSentDates,
      updated_at: nowISO(),
    });
  }

  return { ok: true, emailsSent, skipped, log };
}

/** Server action cho Dean/Admin trigger toàn bộ reminders hôm nay */
export async function triggerDeadlineReminderAction() {
  try {
    await requireDean();
    const result = await runDeadlineReminder();
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi không xác định");
  }
}

/** Gửi ngay một reminder cụ thể (bỏ qua kiểm tra ngày, cập nhật sent_dates) */
export async function triggerSingleReminderAction(reminderId: string) {
  try {
    await requireDean();

    const reminder = (await db.reminders.findById(reminderId)) as Record<string, string> | null;
    if (!reminder) return err("Không tìm thấy nhắc hạn");

    const { title, content, deadline_date, email_list, sent_dates } = reminder;
    const today = todayStr();
    const daysLeft = daysUntil(deadline_date);
    const deadlineFormatted = formatDate(deadline_date);
    const emails = (email_list ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const alreadySentDates = (sent_dates ?? "").split(",").map((d) => d.trim()).filter(Boolean);

    const log: string[] = [];
    let emailsSent = 0;

    if (!isEmailConfigured()) {
      log.push("SMTP chưa cấu hình — không gửi email được");
    } else {
      for (const email of emails) {
        try {
          await sendGenericEmail({
            to: email,
            subject: `[KLTN] Nhắc nhở: ${title} – còn ${daysLeft} ngày`,
            title,
            content: content || `Hạn nộp "${title}" là ngày ${deadlineFormatted}, còn ${daysLeft} ngày. Vui lòng hoàn thành đúng hạn.`,
            deadlineFormatted,
            daysLeft,
          });
          emailsSent++;
        } catch (e) {
          log.push(`Lỗi gửi ${email}: ${String(e)}`);
        }
      }
    }

    // Cập nhật sent_dates (thêm hôm nay nếu chưa có)
    if (!alreadySentDates.includes(today)) {
      const newSentDates = [...alreadySentDates, today].join(",");
      await db.reminders.update(reminderId, { sent_dates: newSentDates, updated_at: nowISO() });
    }

    return ok({ emailsSent, log });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi không xác định");
  }
}
