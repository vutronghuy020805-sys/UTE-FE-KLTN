import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { generateBBGVHD, generateBBGVPB, generateBBHD } from "@/lib/generate-bb";
import { downloadFileFromDrive } from "@/lib/drive-client";
import JSZip from "jszip";

export const maxDuration = 60;

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const user = await db.users.findById(session.user.id);
  if (!user || !["DEAN", "ADMIN"].includes(user.system_role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const revisionStatuses = [
    "CAN_CHINH_SUA",
    "CHO_GVHD_XAC_NHAN",
    "CHO_CHU_TICH_DUYET",
    "HOAN_TAT",
  ];
  const allTopics = await db.topics.getAll();
  const revisionTopics = allTopics.filter(
    (t) => t.topic_type === "KLTN" && revisionStatuses.includes(t.current_status),
  );

  const masterZip = new JSZip();

  for (const topic of revisionTopics) {
    const student = await db.users.findById(topic.student_id);
    const mssv = student?.student_code ?? topic.id;

    const [bbGvhd, bbGvpb, bbHd, allFiles] = await Promise.all([
      generateBBGVHD(topic.id),
      generateBBGVPB(topic.id),
      generateBBHD(topic.id),
      db.files.filter({ topic_id: topic.id }),
    ]);

    const chinhSuaFiles = allFiles.filter((f) => f.file_type === "CHINH_SUA");
    const giaiTrinhFiles = allFiles.filter((f) => f.file_type === "PHIEU_GIAI_TRINH");

    const tryDownload = async (f: (typeof allFiles)[0]) => {
      try {
        const buffer = await downloadFileFromDrive(f.stored_name);
        return { name: f.original_name || f.stored_name, buffer };
      } catch {
        return null;
      }
    };

    const [csDownloads, gtDownloads] = await Promise.all([
      Promise.all(chinhSuaFiles.map(tryDownload)),
      Promise.all(giaiTrinhFiles.map(tryDownload)),
    ]);

    const folder = masterZip.folder(mssv)!;
    if (bbGvhd) folder.file(`BB_GVHD_${mssv}.docx`, bbGvhd);
    if (bbGvpb) folder.file(`BB_GVPB_${mssv}.docx`, bbGvpb);
    if (bbHd) folder.file(`BB_HoiDong_${mssv}.docx`, bbHd);

    for (const f of csDownloads) {
      if (f) folder.file(`BaiChinhSua_${f.name}`, f.buffer);
    }
    for (const f of gtDownloads) {
      if (f) folder.file(`BBGiaiTrinh_${f.name}`, f.buffer);
    }
  }

  const buffer = await masterZip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''TatCaBienBan.zip`,
    },
  });
}
