import { NextResponse } from "next/server";
import { db } from "@/lib/sheets/client";

export async function GET() {
  try {
    const rows = await db.fieldTopics.getAll();
    // rows có cột: Email (gmail giảng viên), Major (ngành), Field (lĩnh vực)
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
