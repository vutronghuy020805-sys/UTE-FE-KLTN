import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { generateId, nowISO } from "@/lib/utils";
import { writeAuditLog, recordStatusChange } from "@/lib/server-helpers";
import { uploadFileToDrive, getOrCreateSubfolder } from "@/lib/drive-client";
import type { FileType } from "@/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const topicId = formData.get("topic_id") as string;
    const fileType = formData.get("file_type") as FileType;

    if (!file)
      return NextResponse.json({ error: "Không có file" }, { status: 400 });
    if (!topicId)
      return NextResponse.json({ error: "Thiếu topic_id" }, { status: 400 });
    if (!fileType)
      return NextResponse.json({ error: "Thiếu loại file" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File quá lớn (tối đa 50MB)" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Định dạng file không được hỗ trợ. Chỉ chấp nhận: PDF, Word, Excel, ảnh, text",
        },
        { status: 400 },
      );
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: "Đề tài không tồn tại" },
        { status: 404 },
      );
    }

    if (session.user.system_role === "STUDENT") {
      if (topic.student_id !== session.user.id) {
        return NextResponse.json(
          { error: "Không có quyền upload file cho đề tài này" },
          { status: 403 },
        );
      }
      if (fileType === "KHOA_LUAN") {
        return NextResponse.json(
          { error: "Bài khóa luận sẽ được GVHD nộp thay. Vui lòng liên hệ GVHD." },
          { status: 403 },
        );
      }
      if (fileType === "BAI_BAO") {
        return NextResponse.json(
          { error: "Chỉ GVHD mới được upload Bài báo khoa học." },
          { status: 403 },
        );
      }
    }

    if (
      ["LECTURER", "DEAN"].includes(session.user.system_role) &&
      topic.supervisor_id !== session.user.id
    ) {
      const committee = await db.committees.findByTopic(topicId);

      // Chủ tịch hội đồng được phép upload file nhận xét góp ý
      if (fileType === "NHAN_XET_HOI_DONG") {
        if (committee?.chair_id !== session.user.id) {
          return NextResponse.json(
            { error: "Chỉ Chủ tịch hội đồng mới được upload file nhận xét" },
            { status: 403 },
          );
        }
      // Thư ký hội đồng được phép upload biên bản hội đồng
      } else if (fileType === "BIEN_BAN_HOI_DONG") {
        if (committee?.secretary_id !== session.user.id) {
          return NextResponse.json(
            { error: "Chỉ Thư ký hội đồng mới được upload biên bản" },
            { status: 403 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Không có quyền upload file cho đề tài này" },
          { status: 403 },
        );
      }
    }

    // Upload lên Google Drive
    // Cấu trúc folder: root / topic_id / file_type / file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = `${topicId}_${fileType}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F]/g, "_")}`;
    const { fileId: driveFileId, fileUrl } = await uploadFileToDrive(
      buffer,
      safeName,
      file.type,
      ROOT_FOLDER_ID,
    );

    const fileId = generateId();

    // Cho SV nộp file CHỈNH SỬA: file sau ghi đè file trước (xóa file cũ
    // cùng file_type trong topic này). GVHD/CT chỉ thấy file mới nhất.
    if (
      session.user.system_role === "STUDENT" &&
      (fileType === "CHINH_SUA" || fileType === "PHIEU_GIAI_TRINH")
    ) {
      const existing = await db.files.filter({
        topic_id: topicId,
        file_type: fileType,
      });
      for (const oldFile of existing) {
        await db.files.delete(oldFile.id, fileType).catch(() => { /* silent */ });
      }
    }

    await db.files.create({
      id: fileId,
      topic_id: topicId,
      uploaded_by: session.user.id,
      file_type: fileType,
      original_name: file.name,
      stored_name: driveFileId,
      file_url: fileUrl,
      mime_type: file.type,
      file_size: file.size,
      uploaded_at: nowISO(),
    });

    if (fileType === "KHOA_LUAN" && ["LECTURER", "DEAN"].includes(session.user.system_role) && topic.supervisor_id === session.user.id) {
      await db.topics.update(topicId, {
        current_status: "CHO_CHAM_HUONG_DAN",
        updated_at: nowISO(),
      });

      if (topic.student_id) {
        await db.notifications.create({
          id: generateId(),
          user_id: topic.student_id,
          title: "GVHD đã nộp bài khóa luận",
          content: `GVHD đã nộp bài khóa luận "${topic.title}" lên hệ thống.`,
          is_read: false,
          created_at: nowISO(),
        });
      }
    }

    // BCTT: khi sinh viên nộp file báo cáo → chuyển sang DA_NOP_BAO_CAO
    if (fileType === "BAO_CAO" && session.user.system_role === "STUDENT" && topic.topic_type === "BCTT") {
      await db.topics.update(topicId, {
        current_status: "DA_NOP_BAO_CAO",
        updated_at: nowISO(),
      });

      if (topic.supervisor_id) {
        await db.notifications.create({
          id: generateId(),
          user_id: topic.supervisor_id,
          title: "Sinh viên đã nộp Báo cáo thực tập",
          content: `${session.user.name} đã nộp báo cáo thực tập "${topic.title}". Vui lòng kiểm tra và chấm điểm.`,
          is_read: false,
          created_at: nowISO(),
        });
      }
    }

    // GVHD upload Turnitin hoặc Bài báo → thông báo cho GVPB và tất cả thành viên hội đồng
    if (
      (fileType === "TURNITIN" || fileType === "BAI_BAO") &&
      ["LECTURER", "DEAN"].includes(session.user.system_role) &&
      topic.supervisor_id === session.user.id
    ) {
      const committee = await db.committees.findByTopic(topicId);
      const recipientIds = new Set<string>();

      // GVPB
      if (topic.reviewer_id) recipientIds.add(topic.reviewer_id);

      // Thành viên hội đồng
      if (committee) {
        [
          committee.chair_id,
          committee.secretary_id,
          committee.member_1_id,
          committee.member_2_id,
          committee.member_3_id,
          committee.member_4_id,
          committee.member_5_id,
        ].filter(Boolean).forEach((id) => recipientIds.add(id));
      }

      // Bỏ chính người upload
      recipientIds.delete(session.user.id);

      const notifTitle = fileType === "TURNITIN" ? "File Turnitin đã được cập nhật" : "GVHD đã upload Bài báo khoa học";
      const notifContent = fileType === "TURNITIN"
        ? `GVHD đã upload file kiểm tra đạo văn (Turnitin) cho khóa luận "${topic.title}". Vui lòng xem trước khi họp hội đồng.`
        : `GVHD đã upload Bài báo khoa học cho khóa luận "${topic.title}". Vui lòng xem nếu cần.`;
      for (const recipientId of recipientIds) {
        await db.notifications.create({
          id: generateId(),
          user_id: recipientId,
          title: notifTitle,
          content: notifContent,
          is_read: false,
          created_at: nowISO(),
        });
      }
    }

    // Chủ tịch HĐ gửi nhận xét góp ý → chuyển sang CAN_CHINH_SUA + tạo revision record
    if (fileType === "NHAN_XET_HOI_DONG") {
      const councilPhases = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG"];
      if (councilPhases.includes(topic.current_status)) {
        await db.topics.update(topicId, {
          current_status: "CAN_CHINH_SUA",
          updated_at: nowISO(),
        });
        await recordStatusChange(
          topicId,
          topic.current_status,
          "CAN_CHINH_SUA",
          session.user.id,
          "Chủ tịch HĐ gửi nhận xét góp ý",
        );
        await db.revisions.create({
          id: generateId(),
          topic_id: topicId,
          requested_by: session.user.id,
          request_note:
            "Hội đồng yêu cầu chỉnh sửa. Xem file nhận xét góp ý để biết chi tiết.",
          revised_file_id: "",
          is_approved: "false",
          approved_by: "",
          approved_at: "",
          created_at: nowISO(),
          updated_at: nowISO(),
        });
      }

      await db.notifications.create({
        id: generateId(),
        user_id: topic.student_id,
        title: "Chủ tịch Hội đồng đã gửi nhận xét góp ý",
        content: `Hội đồng đã gửi file nhận xét góp ý cho khóa luận "${topic.title}". Vui lòng xem trong trang chi tiết đề tài.`,
        is_read: false,
        created_at: nowISO(),
      });
    }

    // Thư ký upload biên bản → chỉ thông báo nội bộ (chưa gửi cho sinh viên)
    if (fileType === "BIEN_BAN_HOI_DONG") {
      await db.notifications.create({
        id: generateId(),
        user_id: topic.student_id,
        title: "Biên bản hội đồng đã được upload",
        content: `Thư ký hội đồng đã upload Biên bản hội đồng cho khóa luận "${topic.title}". Chờ thư ký xác nhận để bắt đầu chỉnh sửa.`,
        is_read: false,
        created_at: nowISO(),
      });
    }

    await writeAuditLog(session.user.id, "UPLOAD_FILE", "files", fileId, {
      topicId,
      fileType,
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json({
      success: true,
      fileId,
      fileUrl,
      originalName: file.name,
      message: "Upload file thành công",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi khi upload file" },
      { status: 500 },
    );
  }
}
