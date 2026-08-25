import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const topics = await db.topics.filter({ student_id: session.user.id });

  // Gắn thêm tên supervisor cho mỗi topic
  const topicsWithSupervisor = await Promise.all(
    topics.map(async (t) => {
      const supervisor = t.supervisor_id
        ? await db.users.findById(t.supervisor_id)
        : null;
      return {
        ...t,
        supervisor_name: supervisor?.full_name ?? null,
      };
    }),
  );

  return NextResponse.json({ topics: topicsWithSupervisor });
}
