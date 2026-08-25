import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";

export const maxDuration = 60;

/**
 * Dedup BIEN_BAN_HOI_DONG: với mỗi topic, giữ lại file mới nhất (theo uploaded_at)
 * và xóa các bản cũ. Chỉ DEAN/ADMIN call được. Trả về số file đã xóa.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.users.findById(session.user.id);
  if (!user || !["DEAN", "ADMIN"].includes(user.system_role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allBbhd = await db.files.filter({ file_type: "BIEN_BAN_HOI_DONG" });

  const byTopic = new Map<string, typeof allBbhd>();
  for (const f of allBbhd) {
    if (!byTopic.has(f.topic_id)) byTopic.set(f.topic_id, []);
    byTopic.get(f.topic_id)!.push(f);
  }

  let deleted = 0;
  const details: { topicId: string; kept: string; removed: number }[] = [];

  for (const [topicId, files] of byTopic.entries()) {
    if (files.length <= 1) continue;
    // Giữ file mới nhất (uploaded_at lớn nhất); fallback id
    const sorted = [...files].sort((a, b) => {
      const ta = a.uploaded_at ?? "";
      const tb = b.uploaded_at ?? "";
      if (ta !== tb) return tb.localeCompare(ta);
      return (b.id ?? "").localeCompare(a.id ?? "");
    });
    const [keep, ...rest] = sorted;
    for (const old of rest) {
      try {
        await db.files.delete(old.id, "BIEN_BAN_HOI_DONG");
        deleted++;
      } catch (e) {
        console.error("[dedupe-bbhd] xóa lỗi:", old.id, e);
      }
    }
    details.push({ topicId, kept: keep.id, removed: rest.length });
  }

  return NextResponse.json({
    ok: true,
    totalTopicsScanned: byTopic.size,
    deleted,
    details,
  });
}
