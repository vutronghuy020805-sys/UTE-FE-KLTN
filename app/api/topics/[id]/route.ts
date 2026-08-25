import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.system_role?.toUpperCase();
  if (role !== "LECTURER" && role !== "DEAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title } = body as { title?: string };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Tên đề tài không được để trống" }, { status: 400 });
  }

  const topic = await db.topics.findById(id);
  if (!topic) return NextResponse.json({ error: "Không tìm thấy đề tài" }, { status: 404 });

  if (topic.supervisor_id !== session.user.id) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa đề tài này" }, { status: 403 });
  }

  await db.topics.update(id, { title: title.trim() });

  return NextResponse.json({ success: true });
}
