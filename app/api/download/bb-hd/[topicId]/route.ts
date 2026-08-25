import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { readFileSync } from "fs";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createSignatureHandler, fetchSignatureBuffer } from "@/lib/docx-signature";

function parseCommentText(comment: string): string {
  try {
    const parsed = JSON.parse(comment);
    return parsed.__text ?? "";
  } catch { return comment ?? ""; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = await db.topics.findById(topicId);
  if (!topic) return NextResponse.json({ error: "Không tìm thấy đề tài" }, { status: 404 });

  const committee = await db.committees.findByTopic(topicId);
  if (!committee) return NextResponse.json({ error: "Đề tài chưa có hội đồng" }, { status: 404 });

  // Chỉ thư ký, chủ tịch, dean, admin được tải
  const userId = session.user.id;
  const user = await db.users.findById(userId);
  const isAllowed =
    committee.secretary_id === userId ||
    committee.chair_id === userId ||
    user?.system_role === "DEAN" ||
    user?.system_role === "ADMIN";
  if (!isAllowed) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const assignment = await db.committeeTopics.findByTopic(topicId);
  const nhanXetHd = assignment?.nhan_xet_hd ?? "";
  const yeuCauChinhSua = assignment?.yeu_cau_chinh_sua ?? "";

  const [student, chair, secretary, reviewer, reviewerScores] = await Promise.all([
    db.users.findById(topic.student_id),
    committee.chair_id ? db.users.findById(committee.chair_id) : Promise.resolve(null),
    committee.secretary_id ? db.users.findById(committee.secretary_id) : Promise.resolve(null),
    topic.reviewer_id ? db.users.findById(topic.reviewer_id) : Promise.resolve(null),
    db.scores.filter({ topic_id: topicId, score_role: "REVIEWER" }),
  ]);

  const reviewerScore = reviewerScores[0] ?? null;
  const nhanXetGvpb = reviewerScore?.comment ? parseCommentText(reviewerScore.comment) : "";

  const now = new Date();
  const data: Record<string, string> = {
    ten_khoa_luan: topic.title ?? "",
    ten_sv: student?.full_name ?? "",
    mssv: student?.student_code ?? "",
    nhan_xet: nhanXetHd,
    yeu_cau_chinh_sua: yeuCauChinhSua,
    nhan_xet_gvpb: nhanXetGvpb,
    ten_gvpb: reviewer?.full_name ?? "",
    ten_chu_tich: chair?.full_name ?? "",
    ten_thu_ky: secretary?.full_name ?? "",
    ngay: String(now.getDate()).padStart(2, "0"),
    thang: String(now.getMonth() + 1).padStart(2, "0"),
    nam: String(now.getFullYear()),
    ngay_thang_nam: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
    ten_hoi_dong: committee.committee_name ?? "",
  };

  const templatePath = join(process.cwd(), "public", "templates", "bb_hd.docx");
  let templateBuffer: Buffer;
  try {
    templateBuffer = readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      { error: "Không tìm thấy file template. Vui lòng đặt bb_hd.docx vào public/templates/" },
      { status: 500 },
    );
  }

  // Tải chữ ký của Chủ tịch và Thư ký từ Drive (nếu có)
  const chairFull = chair ? ((chair as unknown) as Record<string, string>) : null;
  const secretaryFull = secretary ? ((secretary as unknown) as Record<string, string>) : null;
  const [chairSig, secretarySig] = await Promise.all([
    fetchSignatureBuffer(chairFull?.signature_file_id),
    fetchSignatureBuffer(secretaryFull?.signature_file_id),
  ]);

  const { module: imageModule, data: signatureData } = createSignatureHandler({
    chu_ky_chu_tich: chairSig,
    chu_ky_thu_ky: secretarySig,
  });
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
  });

  let outputBuffer: Buffer;
  try {
    doc.render({ ...data, ...signatureData });
    outputBuffer = doc.getZip().generate({ type: "nodebuffer" });
  } catch (e) {
    const err = e as { message?: string; properties?: { errors?: unknown[] } };
    console.error("[bb-hd] doc.render lỗi:", err.message);
    if (err.properties?.errors) {
      console.error("[bb-hd] chi tiết:", JSON.stringify(err.properties.errors, null, 2));
    }
    return NextResponse.json(
      {
        error: "Lỗi render template Word",
        message: err.message,
        details: err.properties?.errors ?? null,
      },
      { status: 500 },
    );
  }

  const fileName = `BB_HoiDong_${student?.student_code ?? topicId}.docx`;

  return new NextResponse(outputBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
