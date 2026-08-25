import "server-only";
import { db } from "@/lib/sheets/client";
import { calculateTotalScore } from "@/lib/constants";
import path from "path";
import ExcelJS from "exceljs";

type StudentRow = Record<string, string | number>;

async function processSheet(
  ws: ExcelJS.Worksheet,
  vars: Record<string, string | number>,
  rows: StudentRow[],
) {
  let templateRowNum = -1;
  ws.eachRow((row, rowNum) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && /\{\{>/.test(cell.value)) templateRowNum = rowNum;
    });
  });

  if (templateRowNum !== -1) {
    const tmplRow = ws.getRow(templateRowNum);
    const tmplCells: Array<{
      col: number; rawValue: string;
      font?: ExcelJS.Font; fill?: ExcelJS.Fill;
      border?: Partial<ExcelJS.Borders>; alignment?: Partial<ExcelJS.Alignment>;
      numFmt?: string;
    }> = [];

    tmplRow.eachCell({ includeEmpty: false }, (cell, col) => {
      tmplCells.push({
        col,
        rawValue: typeof cell.value === "string" ? cell.value : "",
        font: cell.font ? (JSON.parse(JSON.stringify(cell.font)) as ExcelJS.Font) : undefined,
        fill: cell.fill ? (JSON.parse(JSON.stringify(cell.fill)) as ExcelJS.Fill) : undefined,
        border: cell.border ? { ...cell.border } : undefined,
        alignment: cell.alignment ? { ...cell.alignment } : undefined,
        numFmt: cell.numFmt || undefined,
      });
    });

    const tmplHeight = tmplRow.height;

    if (rows.length > 1) {
      ws.spliceRows(templateRowNum + 1, 0, ...Array(rows.length - 1).fill([]));
    }

    rows.forEach((rowData, idx) => {
      const targetRow = ws.getRow(templateRowNum + idx);
      if (tmplHeight) targetRow.height = tmplHeight;

      tmplCells.forEach(({ col, rawValue, font, fill, border, alignment, numFmt }) => {
        const cell = targetRow.getCell(col);
        if (font) cell.font = font;
        if (fill) cell.fill = fill;
        if (border) cell.border = border;
        if (alignment) cell.alignment = alignment;
        if (numFmt) cell.numFmt = numFmt;

        const filled = rawValue
          .replace(/\{\{>([\w.]+)\}\}/g, (_, key) => {
            const prop = key.includes(".") ? key.split(".").pop()! : key;
            return String(rowData[prop] ?? "");
          })
          .replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
            const prop = key.includes(".") ? key.split(".").pop()! : key;
            return String(rowData[prop] ?? "");
          })
          .trim();

        if (filled === "") cell.value = null;
        else if (!isNaN(Number(filled)) && filled !== "") cell.value = Number(filled);
        else cell.value = filled;
      });
    });

    if (rows.length === 0) {
      tmplRow.eachCell((cell) => { cell.value = null; });
    }
  }

  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && cell.value.includes("{{")) {
        cell.value = cell.value.replace(/\{\{([\w.]+)\}\}/g, (_, key) => String(vars[key] ?? ""));
      }
    });
  });
}

function sheetContains(ws: ExcelJS.Worksheet, keyword: string): boolean {
  let found = false;
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && cell.value.includes(keyword)) found = true;
    });
  });
  return found;
}

/** Tạo Excel "Bảng điểm hội đồng" cho 1 hội đồng. */
export async function generateExcelHDByCommittee(committeeId: string): Promise<Buffer | null> {
  try {
    const committee = await db.committees.findById(committeeId);
    if (!committee) return null;

    const allAssignments = await db.committeeTopics.filter({ committee_id: committee.id });
    const topicIds = allAssignments.map((a) => a.topic_id);

    const scorerIds = [
      committee.chair_id, committee.member_1_id, committee.member_2_id,
      committee.member_3_id, committee.member_4_id, committee.member_5_id,
    ].filter(Boolean) as string[];

    const [scorerUsers, chairUser, secretaryUser, member1User, member2User] = await Promise.all([
      Promise.all(scorerIds.map((id) => db.users.findById(id))),
      db.users.findById(committee.chair_id),
      db.users.findById(committee.secretary_id),
      committee.member_1_id ? db.users.findById(committee.member_1_id) : Promise.resolve(null),
      committee.member_2_id ? db.users.findById(committee.member_2_id) : Promise.resolve(null),
    ]);

    const scorers = scorerIds.map((id, i) => ({ id, name: scorerUsers[i]?.full_name ?? "—" }));

    const rowsRaw = await Promise.all(
      topicIds.map(async (tid, idx) => {
        const [t, allScores] = await Promise.all([
          db.topics.findById(tid),
          db.scores.filter({ topic_id: tid }),
        ]);
        if (!t) return null;
        const student = await db.users.findById(t.student_id);

        const svScore = allScores.find((s) => s.score_role === "SUPERVISOR");
        const pbScore = allScores.find((s) => s.score_role === "REVIEWER");
        // Dedupe: nếu 1 scorer có nhiều row (bug race condition cũ), giữ row mới nhất
        const committeeRaw = allScores.filter((s) => s.score_role === "COMMITTEE_MEMBER");
        const latestByScorer = new Map<string, typeof committeeRaw[0]>();
        for (const s of committeeRaw) {
          const existing = latestByScorer.get(s.scorer_id);
          if (!existing) {
            latestByScorer.set(s.scorer_id, s);
          } else {
            const newTs = s.updated_at ?? s.created_at ?? "";
            const oldTs = existing.updated_at ?? existing.created_at ?? "";
            if (newTs > oldTs) latestByScorer.set(s.scorer_id, s);
          }
        }
        const committeeScores = [...latestByScorer.values()];

        const scoreByMember: Record<string, number | null> = {};
        for (const m of scorers) {
          const sc = committeeScores.find((s) => s.scorer_id === m.id);
          scoreByMember[m.id] = sc != null ? Number(sc.score_value) : null;
        }

        const hdVals = scorers.map((m) => scoreByMember[m.id]).filter((v): v is number => v !== null);
        const hdAvg = hdVals.length > 0 ? hdVals.reduce((a, b) => a + b, 0) / hdVals.length : null;
        const total = calculateTotalScore(
          svScore ? Number(svScore.score_value) : undefined,
          pbScore ? Number(pbScore.score_value) : undefined,
          hdVals,
        );

        return {
          stt: idx + 1,
          mssv: student?.student_code ?? "—",
          ho_va_ten: student?.full_name ?? "—",
          svScore: svScore ? Number(svScore.score_value) : null,
          pbScore: pbScore ? Number(pbScore.score_value) : null,
          scoreByMember, hdAvg, total,
        };
      }),
    );
    const rows = rowsRaw.filter(Boolean) as NonNullable<(typeof rowsRaw)[0]>[];

    const defDate = committee.defense_date ? new Date(committee.defense_date) : new Date();
    const commonVars = {
      phong: committee.defense_location ?? "",
      ngay: defDate.getDate(),
      thang: defDate.getMonth() + 1,
      nam: defDate.getFullYear(),
      ten_chu_tich: chairUser?.full_name ?? "—",
      ten_thu_ky: secretaryUser?.full_name ?? "—",
      ten_thanh_vien_1: member1User?.full_name ?? "—",
      ten_thanh_vien_2: member2User?.full_name ?? "—",
    };

    const diemHdVars = {
      ...commonVars,
      member1: scorers[0]?.name ?? "",
      member2: scorers[1]?.name ?? "",
      member3: scorers[2]?.name ?? "",
    };

    const diemHdRows: StudentRow[] = rows.map((r) => ({
      stt: r.stt, mssv: r.mssv, ho_va_ten: r.ho_va_ten,
      diem1: r.scoreByMember[scorers[0]?.id] != null ? Number(r.scoreByMember[scorers[0].id]!.toFixed(2)) : "",
      diem2: r.scoreByMember[scorers[1]?.id] != null ? Number(r.scoreByMember[scorers[1].id]!.toFixed(2)) : "",
      diem3: r.scoreByMember[scorers[2]?.id] != null ? Number(r.scoreByMember[scorers[2].id]!.toFixed(2)) : "",
      trung_binh: r.hdAvg != null ? Number(r.hdAvg.toFixed(2)) : "",
    }));

    const tongHopRows: StudentRow[] = rows.map((r) => ({
      stt: r.stt, mssv: r.mssv, ho_va_ten: r.ho_va_ten,
      diem_gvhd: r.svScore != null ? Number(r.svScore.toFixed(2)) : "",
      diem_gvpb: r.pbScore != null ? Number(r.pbScore.toFixed(2)) : "",
      diem_hd: r.hdAvg != null ? Number(r.hdAvg.toFixed(2)) : "",
      trung_binh: r.total != null ? Number(r.total.toFixed(2)) : "",
    }));

    const templatePath = path.join(process.cwd(), "public/templates/bang_diem_hd.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);

    for (const ws of wb.worksheets) {
      if (sheetContains(ws, "member1")) await processSheet(ws, diemHdVars, diemHdRows);
      else await processSheet(ws, commonVars, tongHopRows);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  } catch (e) {
    console.error("[generateExcelHDByCommittee] error:", e);
    return null;
  }
}
