import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { createResumableUploadSession } from "@/lib/drive-client";
import type { FileType } from "@/types";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
];

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { topicId, fileType, fileName, mimeType, fileSize } = body as {
      topicId: string;
      fileType: FileType;
      fileName: string;
      mimeType: string;
      fileSize: number;
    };

    if (!topicId) return NextResponse.json({ error: "Thiếu topic_id" }, { status: 400 });
    if (!fileType) return NextResponse.json({ error: "Thiếu loại file" }, { status: 400 });
    if (!fileName) return NextResponse.json({ error: "Thiếu tên file" }, { status: 400 });

    const resolvedMime = mimeType || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(resolvedMime)) {
      return NextResponse.json(
        { error: "Định dạng file không được hỗ trợ. Chỉ chấp nhận: PDF, Word, Excel, ảnh, text" },
        { status: 400 },
      );
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) return NextResponse.json({ error: "Đề tài không tồn tại" }, { status: 404 });

    // Permission check — same logic as /api/upload
    if (session.user.system_role === "STUDENT" && topic.student_id !== session.user.id) {
      return NextResponse.json({ error: "Không có quyền upload file cho đề tài này" }, { status: 403 });
    }

    const isLecturer = ["LECTURER", "DEAN"].includes(session.user.system_role);
    if (isLecturer && topic.supervisor_id !== session.user.id) {
      const committee = await db.committees.findByTopic(topicId);
      if (fileType === "NHAN_XET_HOI_DONG") {
        if (committee?.chair_id !== session.user.id)
          return NextResponse.json({ error: "Chỉ Chủ tịch hội đồng mới được upload file nhận xét" }, { status: 403 });
      } else if (fileType === "BIEN_BAN_HOI_DONG") {
        if (committee?.secretary_id !== session.user.id)
          return NextResponse.json({ error: "Chỉ Thư ký hội đồng mới được upload biên bản" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Không có quyền upload file cho đề tài này" }, { status: 403 });
      }
    }

    const storedName = `${topicId}_${fileType}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F]/g, "_")}`;

    const uploadUrl = await createResumableUploadSession(
      storedName,
      resolvedMime,
      ROOT_FOLDER_ID,
      fileSize,
    );

    return NextResponse.json({ uploadUrl, storedName });
  } catch (error) {
    console.error("Initiate upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi khởi tạo upload" },
      { status: 500 },
    );
  }
}
