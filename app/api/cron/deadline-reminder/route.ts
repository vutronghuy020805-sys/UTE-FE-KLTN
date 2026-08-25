import { NextRequest, NextResponse } from "next/server";
import { runDeadlineReminder } from "@/app/actions/cron.actions";

export async function GET(req: NextRequest) {
  // Vercel Cron gửi Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const tokenFromHeader = authHeader?.replace("Bearer ", "");
  const tokenFromQuery = req.nextUrl.searchParams.get("secret");
  const token = tokenFromHeader ?? tokenFromQuery;

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDeadlineReminder();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/deadline-reminder]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
