import { NextRequest, NextResponse } from "next/server";
import { fetchCriteriaSheet } from "@/lib/sheets/client";
import { SHEET_NAMES } from "@/lib/constants";

export interface CriterionDef {
  key: string;
  label: string;
  maxScore: number;
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  const sheetName =
    category === "UNG_DUNG"
      ? SHEET_NAMES.BB_GVHD_UNG_DUNG
      : category === "NGHIEN_CUU"
      ? SHEET_NAMES.BB_GVHD_NGHIEN_CUU
      : null;

  if (!sheetName) {
    return NextResponse.json({ criteria: [] });
  }

  try {
    const rows = await fetchCriteriaSheet(sheetName);
    const criteria: CriterionDef[] = rows.map((r, i) => ({
      key: `tc${i + 1}`,
      label: r.label,
      maxScore: r.maxScore,
    }));
    return NextResponse.json({ criteria });
  } catch {
    return NextResponse.json({ criteria: [] });
  }
}
