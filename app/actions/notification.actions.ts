"use server";

import { db } from "@/lib/sheets/client";
import { requireAuth } from "@/lib/permissions";
import { nowISO, ok, err } from "@/lib/utils";

export async function getNotificationsAction() {
  try {
    const user = await requireAuth();
    const notifs = await db.notifications.filter({ user_id: user.id });
    // Sắp xếp mới nhất trước
    return ok(notifs.sort((a, b) => b.created_at.localeCompare(a.created_at)));
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export async function markReadAction(notifId: string) {
  try {
    await requireAuth();
    await db.notifications.update(notifId, { is_read: true });
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}

export async function markAllReadAction() {
  try {
    const user = await requireAuth();
    const notifs = await db.notifications.filter({ user_id: user.id, is_read: "false" });
    for (const n of notifs) {
      await db.notifications.update(n.id, { is_read: true });
    }
    return ok();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi");
  }
}
