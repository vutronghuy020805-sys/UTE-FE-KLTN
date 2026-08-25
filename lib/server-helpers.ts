import "server-only";
import { db } from "@/lib/sheets/client";
import { generateId, nowISO } from "@/lib/utils";

// ============================================================
// AUDIT LOG HELPER
// ============================================================
export async function writeAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await db.auditLogs.create({
    id: generateId(),
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata_json: JSON.stringify(metadata ?? {}),
    created_at: nowISO(),
  });
}

// ============================================================
// NOTIFICATION HELPER
// ============================================================
export async function sendNotification(
  userId: string,
  title: string,
  content: string,
) {
  await db.notifications.create({
    id: generateId(),
    user_id: userId,
    title,
    content,
    is_read: false,
    created_at: nowISO(),
  });
}

// ============================================================
// STATUS HISTORY HELPER
// ============================================================
export async function recordStatusChange(
  topicId: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  note?: string,
) {
  await db.statusHistories.create({
    id: generateId(),
    topic_id: topicId,
    old_status: oldStatus,
    new_status: newStatus,
    note: note ?? "",
    changed_by: changedBy,
    changed_at: nowISO(),
  });
}
