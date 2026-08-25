import "server-only";
import { db, fetchCriteriaSheet } from "@/lib/sheets/client";
import { SHEET_NAMES } from "@/lib/constants";
import { createSignatureHandler, fetchSignatureBuffer } from "@/lib/docx-signature";
import { readFileSync } from "fs";
import { join } from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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

function renderDocx(templatePath: string, data: Record<string, string>): Buffer {
  const templateBuffer = readFileSync(templatePath);
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}


export async function generateBBGVHD(topicId: string): Promise<Buffer | null> {
  try {
    const topic = await db.topics.findById(topicId);
    if (!topic) return null;

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

    let criteria: { label: string; maxScore: number }[] = [];
    if (topic.topic_category) {
      const sheetName = topic.topic_category === "UNG_DUNG"
        ? SHEET_NAMES.BB_GVHD_UNG_DUNG
        : SHEET_NAMES.BB_GVHD_NGHIEN_CUU;
      try { criteria = await fetchCriteriaSheet(sheetName); } catch { /* dùng mặc định */ }
    }

    const scoreData: Record<string, string> = {};
    const count = Math.max(criteria.length, 8);
    for (let i = 1; i <= count; i++) {
      const key = `tc${i}`;
      const val = criteriaScores[key];
      scoreData[key] = val !== undefined ? String(val) : "";
    }

    // Chữ ký GVHD (nếu có signature_file_id trên users)
    const supervisorFull = supervisor ? ((supervisor as unknown) as Record<string, string>) : null;
    const gvhdSig = await fetchSignatureBuffer(supervisorFull?.signature_file_id);
    const { module: imageModule, data: signatureData } = createSignatureHandler({
      chu_ky_gvhd: gvhdSig,
    });

    const now = new Date();
    const data: Record<string, string> = {
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
      ...scoreData,
      ...signatureData,
    };

    const templateBuffer = readFileSync(join(process.cwd(), "public", "templates", "bb_gvhd.docx"));
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      modules: [imageModule],
    });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  } catch (e) {
    console.error("[generateBBGVHD] error:", e);
    return null;
  }
}

export async function generateBBGVPB(topicId: string): Promise<Buffer | null> {
  try {
    const topic = await db.topics.findById(topicId);
    if (!topic) return null;

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
    const isPassed = totalScore !== null && totalScore >= 5;

    let criteria: { label: string; maxScore: number }[] = [];
    if (topic.topic_category) {
      const sheetName = topic.topic_category === "UNG_DUNG"
        ? SHEET_NAMES.BB_GVPB_UNG_DUNG
        : SHEET_NAMES.BB_GVPB_NGHIEN_CUU;
      try { criteria = await fetchCriteriaSheet(sheetName); } catch { /* dùng mặc định */ }
    }

    const scoreData: Record<string, string> = {};
    const count = Math.max(criteria.length, 7);
    for (let i = 1; i <= count; i++) {
      const key = `tc${i}`;
      const val = criteriaScores[key];
      scoreData[key] = val !== undefined ? String(val) : "";
    }

    // Chữ ký GVPB
    const reviewerFull = reviewer ? ((reviewer as unknown) as Record<string, string>) : null;
    const gvpbSig = await fetchSignatureBuffer(reviewerFull?.signature_file_id);
    const { module: imageModule, data: signatureData } = createSignatureHandler({
      chu_ky_gvpb: gvpbSig,
    });

    const now = new Date();
    const data: Record<string, string> = {
      ten_sv: student?.full_name ?? "",
      mssv: student?.student_code ?? "",
      ten_gvpb: reviewer?.full_name ?? "",
      ten_kltn: topic.title ?? "",
      tong_diem: totalScore !== null ? totalScore.toFixed(2) : "",
      ket_luan: isPassed
        ? "Cho SV bảo vệ trước hội đồng"
        : "Không cho SV bảo vệ trước hội đồng",
      nhan_xet: generalComment,
      cau_hoi: cauHoi,
      ngay: String(now.getDate()).padStart(2, "0"),
      thang: String(now.getMonth() + 1).padStart(2, "0"),
      nam: String(now.getFullYear()),
      ...scoreData,
      ...signatureData,
    };

    const templateBuffer = readFileSync(join(process.cwd(), "public", "templates", "bb_gvpb.docx"));
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      modules: [imageModule],
    });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  } catch (e) {
    console.error("[generateBBGVPB] error:", e);
    return null;
  }
}

export async function generatePhieuChamHD(
  topicId: string,
  scorerId: string,
): Promise<Buffer | null> {
  try {
    const topic = await db.topics.findById(topicId);
    if (!topic) return null;

    const committee = await db.committees.findByTopic(topicId);
    if (!committee) return null;

    const scores = await db.scores.filter({
      topic_id: topicId,
      score_role: "COMMITTEE_MEMBER",
      scorer_id: scorerId,
    });
    const myScore = scores[0] ?? null;
    const criteriaScores = myScore?.comment ? parseCriteriaScores(myScore.comment) : {};
    const totalScore = myScore ? Number(myScore.score_value) : null;
    // Fallback cho data CŨ: nếu comment không phải JSON, đọc từ cột tc1..tcN
    // được lưu riêng trên sheet (xem topic.actions.ts saveScore).
    const myScoreRow = (myScore as unknown) as Record<string, string> | null;

    const [student, scorer] = await Promise.all([
      db.users.findById(topic.student_id),
      db.users.findById(scorerId),
    ]);

    let criteria: { label: string; maxScore: number }[] = [];
    try { criteria = await fetchCriteriaSheet(SHEET_NAMES.BB_HD); } catch { /* dùng tiêu chí mặc định */ }

    const scoreData: Record<string, string> = {};
    const count = Math.max(criteria.length, 7);
    for (let i = 1; i <= count; i++) {
      const key = `tc${i}`;
      const fromJson = criteriaScores[key];
      const fromColumn = myScoreRow?.[key];
      const val = fromJson !== undefined ? fromJson : fromColumn;
      scoreData[key] = val !== undefined && val !== "" ? String(val) : "";
    }

    const now = new Date();
    const data = {
      ten_sv: student?.full_name ?? "",
      mssv: student?.student_code ?? "",
      ten_kltn: topic.title ?? "",
      ten_thanh_vien: scorer?.full_name ?? "",
      ten_hoi_dong: committee.committee_name ?? "",
      tong_diem: totalScore !== null ? totalScore.toFixed(2) : "",
      ngay: String(now.getDate()).padStart(2, "0"),
      thang: String(now.getMonth() + 1).padStart(2, "0"),
      nam: String(now.getFullYear()),
      ngay_thang_nam: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
      ...scoreData,
    };

    return renderDocx(join(process.cwd(), "public", "templates", "phieu_cham_hd.docx"), data);
  } catch (e) {
    console.error("[phieu-cham-hd] error:", e);
    return null;
  }
}

export async function generateBBHD(topicId: string): Promise<Buffer | null> {
  try {
    const topic = await db.topics.findById(topicId);
    if (!topic) return null;

    const committee = await db.committees.findByTopic(topicId);
    if (!committee) return null;

    const assignment = await db.committeeTopics.findByTopic(topicId);
    const cleanText = (s: string | undefined | null) =>
      !s || s === "undefined" || s === "null" ? "" : s;
    const nhanXetHd = cleanText(assignment?.nhan_xet_hd);
    const yeuCauChinhSua = cleanText(assignment?.yeu_cau_chinh_sua);

    const [student, chair, secretary, reviewer, reviewerScores] = await Promise.all([
      db.users.findById(topic.student_id),
      committee.chair_id ? db.users.findById(committee.chair_id) : Promise.resolve(null),
      committee.secretary_id ? db.users.findById(committee.secretary_id) : Promise.resolve(null),
      topic.reviewer_id ? db.users.findById(topic.reviewer_id) : Promise.resolve(null),
      db.scores.filter({ topic_id: topicId, score_role: "REVIEWER" }),
    ]);

    const reviewerScore = reviewerScores[0] ?? null;
    const nhanXetGvpb = reviewerScore?.comment ? parseComment(reviewerScore.comment) : "";

    // Tải chữ ký từ Drive (nếu user có signature_file_id)
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

    const now = new Date();
    const data: Record<string, string> = {
      ten_khoa_luan: topic.title ?? "",
      ten_sv: student?.full_name ?? "",
      mssv: student?.student_code ?? "",
      nhan_xet: nhanXetHd,
      nhan_xet_gvpb: nhanXetGvpb,
      yeu_cau_chinh_sua: yeuCauChinhSua,
      ten_chu_tich: chair?.full_name ?? "",
      ten_thu_ky: secretary?.full_name ?? "",
      ten_gvpb: reviewer?.full_name ?? "",
      ngay: String(now.getDate()).padStart(2, "0"),
      thang: String(now.getMonth() + 1).padStart(2, "0"),
      nam: String(now.getFullYear()),
      ngay_thang_nam: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
      ten_hoi_dong: committee.committee_name ?? "",
      ...signatureData,
    };

    const templateBuffer = readFileSync(join(process.cwd(), "public", "templates", "bb_hd.docx"));
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      modules: [imageModule],
    });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  } catch (e) {
    console.error("[generateBBHD] topic=" + topicId + " error:", e);
    return null;
  }
}
