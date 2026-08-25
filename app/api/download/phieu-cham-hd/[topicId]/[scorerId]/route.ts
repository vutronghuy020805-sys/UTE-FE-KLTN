import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { generatePhieuChamHD } from "@/lib/generate-bb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string; scorerId: string }> },
) {
  const { topicId, scorerId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const committee = await db.committees.findByTopic(topicId);
  if (!committee) return new NextResponse("Not found", { status: 404 });

  // Quyền: chính thành viên đó, thư ký, dean, admin
  const userId = session.user.id;
  const user = await db.users.findById(userId);
  const isAllowed =
    userId === scorerId ||
    committee.secretary_id === userId ||
    user?.system_role === "DEAN" ||
    user?.system_role === "ADMIN";
  if (!isAllowed) return new NextResponse("Forbidden", { status: 403 });

  // Người chấm phải nằm trong hội đồng (chair hoặc member 1..5)
  const committeeMemberIds = [
    committee.chair_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].filter(Boolean);
  if (!committeeMemberIds.includes(scorerId)) {
    return new NextResponse("Scorer không thuộc hội đồng", { status: 400 });
  }

  const buffer = await generatePhieuChamHD(topicId, scorerId);
  if (!buffer) {
    return NextResponse.json(
      { error: "Không tạo được phiếu chấm. Kiểm tra template public/templates/phieu_cham_hd.docx" },
      { status: 500 },
    );
  }

  const [topic, scorer] = await Promise.all([
    db.topics.findById(topicId),
    db.users.findById(scorerId),
  ]);
  const student = topic ? await db.users.findById(topic.student_id) : null;
  const mssv = student?.student_code ?? topicId;
  const scorerSlug = (scorer?.full_name ?? scorerId).replace(/\s+/g, "_");
  const fileName = `PhieuCham_${mssv}_${scorerSlug}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
