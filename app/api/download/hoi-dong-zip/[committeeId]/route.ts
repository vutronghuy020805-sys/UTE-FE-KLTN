import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import {
  generateBBGVHD,
  generateBBGVPB,
  generateBBHD,
} from "@/lib/generate-bb";
import { generateExcelHDByCommittee } from "@/lib/generate-excel-hd";
import JSZip from "jszip";

export const maxDuration = 60;

function safe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ committeeId: string }> },
) {
  const { committeeId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const user = await db.users.findById(session.user.id);
  if (!user || !["DEAN", "ADMIN"].includes(user.system_role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const committee = await db.committees.findById(committeeId);
  if (!committee) return new NextResponse("Not found", { status: 404 });

  const assignments = await db.committeeTopics.filter({ committee_id: committeeId });
  const topicIds = assignments.map((a) => a.topic_id);

  const masterZip = new JSZip();
  const root = masterZip.folder(safe(committee.committee_name ?? `HoiDong_${committeeId}`))!;

  // 1. Excel tổng hợp điểm — đặt ở root folder của HĐ
  const excelBuf = await generateExcelHDByCommittee(committeeId);
  if (excelBuf) {
    root.file(`Diem_HD_${safe(committee.committee_name ?? committeeId)}.xlsx`, excelBuf);
  }

  // 2. Subfolder cho từng loại biên bản
  const bbGvhdFolder = root.folder("BB_GVHD")!;
  const bbGvpbFolder = root.folder("BB_GVPB")!;
  const bbHdFolder = root.folder("BB_HoiDong")!;

  // 3. Render từng SV
  for (const topicId of topicIds) {
    const topic = await db.topics.findById(topicId);
    if (!topic) continue;
    const student = await db.users.findById(topic.student_id);
    const mssv = student?.student_code ?? topicId;

    const [bbGvhd, bbGvpb, bbHd] = await Promise.all([
      generateBBGVHD(topicId),
      generateBBGVPB(topicId),
      generateBBHD(topicId),
    ]);

    if (bbGvhd) bbGvhdFolder.file(`BB_GVHD_${mssv}.docx`, bbGvhd);
    if (bbGvpb) bbGvpbFolder.file(`BB_GVPB_${mssv}.docx`, bbGvpb);
    if (bbHd) bbHdFolder.file(`BB_HoiDong_${mssv}.docx`, bbHd);
  }

  const buffer = await masterZip.generateAsync({ type: "nodebuffer" });
  const safeName = encodeURIComponent(`HoiDong_${safe(committee.committee_name ?? committeeId)}`);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}.zip`,
    },
  });
}
