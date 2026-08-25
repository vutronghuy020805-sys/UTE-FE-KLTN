import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { generatePhieuChamHD } from "@/lib/generate-bb";
import JSZip from "jszip";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const committee = await db.committees.findByTopic(topicId);
  if (!committee) return new NextResponse("Not found", { status: 404 });

  // Quyền: thư ký, dean, admin
  const userId = session.user.id;
  const user = await db.users.findById(userId);
  const isAllowed =
    committee.secretary_id === userId ||
    user?.system_role === "DEAN" ||
    user?.system_role === "ADMIN";
  if (!isAllowed) return new NextResponse("Forbidden", { status: 403 });

  // Lấy 3 thành viên chấm điểm: chủ tịch + member 1, 2 (thư ký không chấm)
  const scorerIds = [
    committee.chair_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].filter(Boolean) as string[];

  const [topic, ...scorers] = await Promise.all([
    db.topics.findById(topicId),
    ...scorerIds.map((id) => db.users.findById(id)),
  ]);
  const student = topic ? await db.users.findById(topic.student_id) : null;
  const mssv = student?.student_code ?? topicId;

  const buffers = await Promise.all(scorerIds.map((id) => generatePhieuChamHD(topicId, id)));

  const zip = new JSZip();
  const folder = zip.folder(`PhieuCham_${mssv}`)!;

  let added = 0;
  scorerIds.forEach((id, i) => {
    const buf = buffers[i];
    const scorer = scorers[i];
    if (!buf) return;
    const slug = (scorer?.full_name ?? id).replace(/\s+/g, "_");
    folder.file(`PhieuCham_${mssv}_${slug}.docx`, buf);
    added++;
  });

  if (added === 0) {
    return NextResponse.json(
      { error: "Không tạo được phiếu nào. Kiểm tra template public/templates/phieu_cham_hd.docx" },
      { status: 500 },
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const safeName = encodeURIComponent(`PhieuCham_HD_${mssv}`);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}.zip`,
    },
  });
}
