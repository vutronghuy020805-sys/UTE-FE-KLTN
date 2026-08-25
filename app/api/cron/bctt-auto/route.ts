import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sheets/client";
import { generateId, nowISO } from "@/lib/utils";
import { SHEET_NAMES } from "@/lib/constants";

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenFromHeader = authHeader?.replace("Bearer ", "");
  const tokenFromQuery = req.nextUrl.searchParams.get("secret");
  const token = tokenFromHeader ?? tokenFromQuery;

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await db.settings.getAll();
    const approveEnabled = settings["bctt_auto_approve_enabled"] === "true";
    const approveMinutes = Number(settings["bctt_auto_approve_minutes"] ?? "30");
    const passEnabled = settings["bctt_auto_pass_enabled"] === "true";
    const passMinutes = Number(settings["bctt_auto_pass_minutes"] ?? "60");

    if (!approveEnabled && !passEnabled) {
      return NextResponse.json({ skipped: true, reason: "Không có tính năng tự động nào được bật" });
    }

    const allTopics = await db.topics.getAll();
    const bcttTopics = allTopics.filter((t) => t.topic_type === "BCTT");
    const now = Date.now();

    let approved = 0;
    let passed = 0;

    for (const topic of bcttTopics) {
      const updatedAt = topic.updated_at ? new Date(topic.updated_at).getTime() : 0;
      const elapsedMinutes = (now - updatedAt) / 60_000;

      // Tự động duyệt: CHO_GVHD_DUYET → DANG_THUC_HIEN
      if (approveEnabled && topic.current_status === "CHO_GVHD_DUYET" && elapsedMinutes >= approveMinutes) {
        await db.topics.update(topic.id, { current_status: "DANG_THUC_HIEN", updated_at: nowISO() });
        await recordStatus(topic.id, "CHO_GVHD_DUYET", "DANG_THUC_HIEN", `Tự động duyệt BCTT sau ${approveMinutes} phút`);
        await sendNotif(topic.student_id, "BCTT đã được tự động duyệt",
          "Đề tài BCTT của bạn đã được tự động chuyển sang trạng thái Đang thực hiện. Hãy nộp báo cáo sớm nhé!");
        approved++;
      }

      // Tự động pass: DA_NOP_BAO_CAO → HOAN_TAT
      if (passEnabled && topic.current_status === "DA_NOP_BAO_CAO" && elapsedMinutes >= passMinutes) {
        await db.topics.update(topic.id, { current_status: "HOAN_TAT", updated_at: nowISO() });
        await recordStatus(topic.id, "DA_NOP_BAO_CAO", "HOAN_TAT", `Tự động pass BCTT sau ${passMinutes} phút`);
        await sendNotif(topic.student_id, "BCTT đã được tự động hoàn tất",
          "Chúc mừng! Báo cáo thực tập của bạn đã được tự động xác nhận hoàn tất.");
        passed++;
      }
    }

    return NextResponse.json({ ok: true, approved, passed });
  } catch (err) {
    console.error("[cron/bctt-auto]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
