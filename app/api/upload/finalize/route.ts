import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { makeFilePublic } from "@/lib/drive-client";
import { generateId, nowISO } from "@/lib/utils";
import { writeAuditLog, recordStatusChange } from "@/lib/server-helpers";
import type { FileType } from "@/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { topicId, fileType, driveFileId, originalName, mimeType, fileSize } = body as {
      topicId: string;
      fileType: FileType;
      driveFileId: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
    };

    if (!topicId || !fileType || !driveFileId || !originalName) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const topic = await db.topics.findById(topicId);
    if (!topic) return NextResponse.json({ error: "Đề tài không tồn tại" }, { status: 404 });

    // Make file publicly readable on Drive + get view URL
    const fileUrl = await makeFilePublic(driveFileId);

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
      original_name: originalName,
      stored_name: driveFileId,
      file_url: fileUrl,
      mime_type: mimeType,
      file_size: fileSize,
      uploaded_at: nowISO(),
    });

    // ── Business logic ────────────────────────────────────────────────────

    const isLecturer = ["LECTURER", "DEAN"].includes(session.user.system_role);
    if (fileType === "KHOA_LUAN" && isLecturer && topic.supervisor_id === session.user.id) {
      await db.topics.update(topicId, { current_status: "CHO_CHAM_HUONG_DAN", updated_at: nowISO() });
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

    if (fileType === "BAO_CAO" && session.user.system_role === "STUDENT" && topic.topic_type === "BCTT") {
      await db.topics.update(topicId, { current_status: "DA_NOP_BAO_CAO", updated_at: nowISO() });
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

    if ((fileType === "TURNITIN" || fileType === "BAI_BAO") && isLecturer && topic.supervisor_id === session.user.id) {
      const committee = await db.committees.findByTopic(topicId);
      const recipientIds = new Set<string>();
      if (topic.reviewer_id) recipientIds.add(topic.reviewer_id);
      if (committee) {
        [
          committee.chair_id, committee.secretary_id,
          committee.member_1_id, committee.member_2_id, committee.member_3_id,
          committee.member_4_id, committee.member_5_id,
        ].filter(Boolean).forEach((id) => recipientIds.add(id));
      }
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

    if (fileType === "NHAN_XET_HOI_DONG") {
      const councilPhases = ["CHO_HOI_DONG", "DANG_CHAM_HOI_DONG"];
      if (councilPhases.includes(topic.current_status)) {
        await db.topics.update(topicId, { current_status: "CAN_CHINH_SUA", updated_at: nowISO() });
        await recordStatusChange(topicId, topic.current_status, "CAN_CHINH_SUA", session.user.id, "Chủ tịch HĐ gửi nhận xét góp ý");
        await db.revisions.create({
          id: generateId(),
          topic_id: topicId,
          requested_by: session.user.id,
          request_note: "Hội đồng yêu cầu chỉnh sửa. Xem file nhận xét góp ý để biết chi tiết.",
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
      fileName: originalName,
      fileSize,
      driveFileId,
    });

    return NextResponse.json({ success: true, fileId, fileUrl, originalName, message: "Upload file thành công" });
  } catch (error) {
    console.error("Finalize upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi khi hoàn tất upload" },
      { status: 500 },
    );
  }
}
