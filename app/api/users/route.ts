import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sheets/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["DEAN", "ADMIN"].includes(session.user.system_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = req.nextUrl.searchParams.get("role");
  const users = role
    ? await db.users.filter({ system_role: role })
    : await db.users.getAll();

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      student_code: u.student_code ?? "",
    })),
  });
}
