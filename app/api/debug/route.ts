/**
 * DEBUG ENDPOINT - chỉ dùng trong development
 * Gọi: GET http://localhost:3000/api/debug?email=your@gmail.com
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sheets/client";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email");

  try {
    const allUsers = await db.users.getAll();

    if (!email) {
      return NextResponse.json({
        ok: true,
        total_users: allUsers.length,
        columns: allUsers.length > 0 ? Object.keys(allUsers[0]) : [],
        all_emails: allUsers.map((u) => u.email),
      });
    }

    const found = await db.users.findByEmail(email);

    return NextResponse.json({
      searched_email: email,
      found: !!found,
      user: found ?? null,
      all_emails: allUsers.map((u) => u.email),
    });

  } catch (err: unknown) {
    return NextResponse.json({
      error: (err as Error).message,
      hint: "Kiểm tra GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID trong .env.local",
    }, { status: 500 });
  }
}
