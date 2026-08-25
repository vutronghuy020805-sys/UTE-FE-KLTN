import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, fetchCriteriaSheet } from "@/lib/sheets/client";
import { SHEET_NAMES } from "@/lib/constants";
import { readFileSync } from "fs";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createSignatureHandler, fetchSignatureBuffer } from "@/lib/docx-signature";

function parseCriteriaScores(comment: string): Record<string, number> {
  try {
    const parsed = JSON.parse(comment);
    if (parsed.__criteria) return parsed.__criteria;
  } catch { /* not JSON */ }
  return {};
}

function parseComment(comment: string): string {
  try {
    const parsed = JSON.parse(comment);
    return parsed.__text ?? "";
  } catch { return comment ?? ""; }
}

function parseCauHoi(comment: string): string {
  try {
    const parsed = JSON.parse(comment);
    return parsed.__cau_hoi ?? "";
  } catch { return ""; }
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

  const userId = session.user.id;
  const user = await db.users.findById(userId);

  // Thư ký HĐ phụ trách topic này cũng được xem biên bản GVPB
  const committee = await db.committees.findByTopic(topicId);
  const isSecretary = committee?.secretary_id === userId;

  if (
    topic.reviewer_id !== userId &&
    !isSecretary &&
    user?.system_role !== "DEAN" &&
    user?.system_role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const [student, reviewer, scores] = await Promise.all([
    db.users.findById(topic.student_id),
    topic.reviewer_id ? db.users.findById(topic.reviewer_id) : Promise.resolve(null),
    db.scores.filter({ topic_id: topicId, score_role: "REVIEWER" }),
  ]);

  const reviewerScore = scores[0] ?? null;
  const criteriaScores = reviewerScore?.comment ? parseCriteriaScores(reviewerScore.comment) : {};
  const generalComment = reviewerScore?.comment ? parseComment(reviewerScore.comment) : "";
  const cauHoi = reviewerScore?.comment ? parseCauHoi(reviewerScore.comment) : "";
  const totalScore = reviewerScore ? Number(reviewerScore.score_value) : null;

  // Đọc tiêu chí từ sheet (để biết số lượng tiêu chí)
  let criteria: { label: string; maxScore: number }[] = [];
  if (topic.topic_category) {
    const sheetName = topic.topic_category === "UNG_DUNG"
      ? SHEET_NAMES.BB_GVPB_UNG_DUNG
      : SHEET_NAMES.BB_GVPB_NGHIEN_CUU;
    try { criteria = await fetchCriteriaSheet(sheetName); } catch { /* use default count */ }
  }

  // Build dữ liệu điền vào template
  const isPassed = totalScore !== null && totalScore >= 5;
  const scoreData: Record<string, string> = {};

  // Điền từng tiêu chí tc1..tc7 (hoặc nhiều hơn nếu sheet có)
  const count = Math.max(criteria.length, 7);
  for (let i = 1; i <= count; i++) {
    const key = `tc${i}`;
    const val = criteriaScores[key];
    scoreData[key] = val !== undefined ? String(val) : "";
  }

  const now = new Date();
  const data = {
    ten_sv: student?.full_name ?? "",
    mssv: student?.student_code ?? "",
    ten_gvpb: reviewer?.full_name ?? "",
    ten_kltn: topic.title ?? "",
    tong_diem: totalScore !== null ? totalScore.toFixed(2) : "",
    ket_luan: isPassed ? "Cho SV bảo vệ trước hội đồng" : "Không cho SV bảo vệ trước hội đồng",
    nhan_xet: generalComment,
    cau_hoi: cauHoi,
    ngay: String(now.getDate()).padStart(2, "0"),
    thang: String(now.getMonth() + 1).padStart(2, "0"),
    nam: String(now.getFullYear()),
    ngay_thang_nam: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
    ...scoreData,
  };

  // Đọc file template
  const templatePath = join(process.cwd(), "public", "templates", "bb_gvpb.docx");
  let templateBuffer: Buffer;
  try {
    templateBuffer = readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      { error: "Không tìm thấy file template. Vui lòng đặt bb_gvpb.docx vào public/templates/" },
      { status: 500 }
    );
  }

  // Tải chữ ký GVPB từ Drive (nếu có)
  const reviewerFull = reviewer
    ? ((reviewer as unknown) as Record<string, string>)
    : null;
  const signatureBuf = await fetchSignatureBuffer(reviewerFull?.signature_file_id);

  // Điền dữ liệu vào template (có module image)
  const { module: imageModule, data: signatureData } = createSignatureHandler({
    chu_ky_gvpb: signatureBuf,
  });
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
  });

  doc.render({ ...data, ...signatureData });

  const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });
  const fileName = `BB_GVPB_${student?.student_code ?? topicId}.docx`;

  return new NextResponse(outputBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
