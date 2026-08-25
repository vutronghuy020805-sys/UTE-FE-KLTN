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
  if (
    topic.supervisor_id !== userId &&
    user?.system_role !== "DEAN" &&
    user?.system_role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const [student, supervisor, scores] = await Promise.all([
    db.users.findById(topic.student_id),
    topic.supervisor_id ? db.users.findById(topic.supervisor_id) : Promise.resolve(null),
    db.scores.filter({ topic_id: topicId, score_role: "SUPERVISOR" }),
  ]);

  const svScore = scores[0] ?? null;
  const criteriaScores = svScore?.comment ? parseCriteriaScores(svScore.comment) : {};
  const generalComment = svScore?.comment ? parseComment(svScore.comment) : "";
  const totalScore = svScore ? Number(svScore.score_value) : null;
  const isPassed = totalScore !== null && totalScore >= 5;

  // Lấy tiêu chí từ sheet
  let criteria: { label: string; maxScore: number }[] = [];
  if (topic.topic_category) {
    const sheetName = topic.topic_category === "UNG_DUNG"
      ? SHEET_NAMES.BB_GVHD_UNG_DUNG
      : SHEET_NAMES.BB_GVHD_NGHIEN_CUU;
    try { criteria = await fetchCriteriaSheet(sheetName); } catch { /* dùng mặc định */ }
  }

  // Build dữ liệu điền vào template
  const scoreData: Record<string, string> = {};
  const count = Math.max(criteria.length, 8);
  for (let i = 1; i <= count; i++) {
    const key = `tc${i}`;
    const val = criteriaScores[key];
    scoreData[key] = val !== undefined ? String(val) : "";
  }

  const now = new Date();
  const data = {
    ten_sv: student?.full_name ?? "",
    mssv: student?.student_code ?? "",
    ten_gvhd: supervisor?.full_name ?? "",
    ten_kltn: topic.title ?? "",
    tong_diem: totalScore !== null ? totalScore.toFixed(2) : "",
    ket_luan: isPassed
      ? "Cho sinh viên bảo vệ trước hội đồng"
      : "Không cho sinh viên bảo vệ trước hội đồng",
    nhan_xet: generalComment,
    ngay: String(now.getDate()).padStart(2, "0"),
    thang: String(now.getMonth() + 1).padStart(2, "0"),
    nam: String(now.getFullYear()),
    ngay_thang_nam: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
    ...scoreData,
  };

  // Đọc file template
  const templatePath = join(process.cwd(), "public", "templates", "bb_gvhd.docx");
  let templateBuffer: Buffer;
  try {
    templateBuffer = readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      { error: "Không tìm thấy file template. Vui lòng đặt bb_gvhd.docx vào public/templates/" },
      { status: 500 }
    );
  }

  // Tải chữ ký GVHD từ Drive (nếu có)
  const supervisorFull = supervisor
    ? ((supervisor as unknown) as Record<string, string>)
    : null;
  const signatureBuf = await fetchSignatureBuffer(supervisorFull?.signature_file_id);

  // Điền dữ liệu vào template
  const { module: imageModule, data: signatureData } = createSignatureHandler({
    chu_ky_gvhd: signatureBuf,
  });
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
  });

  doc.render({ ...data, ...signatureData });

  const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });
  const fileName = `BB_GVHD_${student?.student_code ?? topicId}.docx`;

  return new NextResponse(outputBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
