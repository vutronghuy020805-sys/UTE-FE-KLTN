"use server";

import { db } from "@/lib/sheets/client";
import { requireDean } from "@/lib/permissions";
import { ok, err, generateId, nowISO } from "@/lib/utils";

async function recordStatus(topicId: string, from: string, to: string, note: string) {
  await db.statusHistories.create({
    id: generateId(),
    topic_id: topicId,
    old_status: from,
    new_status: to,
    changed_by: "system",
    changed_at: nowISO(),
    note,
  });
}

async function sendNotif(studentId: string, title: string, body: string) {
  await db.notifications.create({
    id: generateId(),
    user_id: studentId,
    title,
    body,
    is_read: "false",
    created_at: nowISO(),
  });
}

export async function runBcttAutoAction(approve: boolean, pass: boolean) {
  try {
    await requireDean();

    if (!approve && !pass) return err("Chưa chọn hành động nào");

    const allTopics = await db.topics.getAll();
    const bcttTopics = allTopics.filter((t) => t.topic_type === "BCTT");

    let approved = 0;
    let passed = 0;

    for (const topic of bcttTopics) {
      if (approve && topic.current_status === "CHO_GVHD_DUYET") {
        await db.topics.update(topic.id, { current_status: "DANG_THUC_HIEN", updated_at: nowISO() });
        await recordStatus(topic.id, "CHO_GVHD_DUYET", "DANG_THUC_HIEN", "TBM tự động duyệt BCTT");
        await sendNotif(topic.student_id, "BCTT đã được duyệt",
          "Đề tài BCTT của bạn đã được xác nhận. Hãy nộp báo cáo sớm nhé!");
        approved++;
      }

      if (pass && topic.current_status === "DA_NOP_BAO_CAO") {
        await db.topics.update(topic.id, { current_status: "HOAN_TAT", updated_at: nowISO() });
        await recordStatus(topic.id, "DA_NOP_BAO_CAO", "HOAN_TAT", "TBM tự động pass BCTT");
        await sendNotif(topic.student_id, "BCTT đã được hoàn tất",
          "Chúc mừng! Báo cáo thực tập của bạn đã được xác nhận hoàn tất.");
        passed++;
      }
    }

    const parts = [];
    if (approve) parts.push(`${approved} đề tài đã được duyệt`);
    if (pass) parts.push(`${passed} đề tài đã được pass`);

    return ok(parts.join(", ") || "Không có đề tài nào cần xử lý");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi khi thực hiện");
  }
}
