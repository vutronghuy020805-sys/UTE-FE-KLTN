import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { generateBBGVHD, generateBBGVPB, generateBBHD } from "@/lib/generate-bb";
import { downloadFileFromDrive } from "@/lib/drive-client";
import JSZip from "jszip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const user = await db.users.findById(session.user.id);
  if (!user || !["DEAN", "ADMIN"].includes(user.system_role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const topic = await db.topics.findById(topicId);
  if (!topic) return new NextResponse("Not found", { status: 404 });

  const student = await db.users.findById(topic.student_id);
  const mssv = student?.student_code ?? topicId;

  const [bbGvhd, bbGvpb, bbHd, allFiles] = await Promise.all([
    generateBBGVHD(topicId),
    generateBBGVPB(topicId),
    generateBBHD(topicId),
    db.files.filter({ topic_id: topicId }),
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

  const [chinhSuaDownloads, giaiTrinhDownloads] = await Promise.all([
    Promise.all(chinhSuaFiles.map(tryDownload)),
    Promise.all(giaiTrinhFiles.map(tryDownload)),
  ]);

  const zip = new JSZip();
  const folder = zip.folder(mssv)!;

  if (bbGvhd) folder.file(`BB_GVHD_${mssv}.docx`, bbGvhd);
  if (bbGvpb) folder.file(`BB_GVPB_${mssv}.docx`, bbGvpb);
  if (bbHd) folder.file(`BB_HoiDong_${mssv}.docx`, bbHd);

  for (const f of chinhSuaDownloads) {
    if (f) folder.file(`BaiChinhSua_${f.name}`, f.buffer);
  }
  for (const f of giaiTrinhDownloads) {
    if (f) folder.file(`BBGiaiTrinh_${f.name}`, f.buffer);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const safeName = encodeURIComponent(`BienBan_${mssv}`);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}.zip`,
    },
  });
}
