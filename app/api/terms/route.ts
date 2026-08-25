import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sheets/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const major = searchParams.get("major") ?? "";
  const type = searchParams.get("type") ?? "";

  if (!major || !type) {
    return NextResponse.json({ terms: [] });
  }

  try {
    const terms = await db.terms.getOpenForRegistration(major, type);
    return NextResponse.json({ terms });
  } catch {
    return NextResponse.json({ terms: [] });
  }
}
