import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { calculateTotalScore } from "@/lib/constants";
import path from "path";
import ExcelJS from "exceljs";

type StudentRow = Record<string, string | number>;

/** Xử lý 1 sheet: expand hàng template và thay thế placeholder */
async function processSheet(
  ws: ExcelJS.Worksheet,
  vars: Record<string, string | number>,
  rows: StudentRow[]
) {
  // 1. Tìm hàng template (chứa {{> ...)
  let templateRowNum = -1;
  ws.eachRow((row, rowNum) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && /\{\{>/.test(cell.value)) {
        templateRowNum = rowNum;
      }
    });
  });

  if (templateRowNum !== -1) {
    const tmplRow = ws.getRow(templateRowNum);

    // 2. Lưu thông tin từng ô của hàng template
    const tmplCells: Array<{
      col: number;
      rawValue: string;
      font?: ExcelJS.Font;
      fill?: ExcelJS.Fill;
      border?: Partial<ExcelJS.Borders>;
      alignment?: Partial<ExcelJS.Alignment>;
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

    // 3. Chèn (rows.length - 1) hàng trống sau hàng template
    if (rows.length > 1) {
      ws.spliceRows(templateRowNum + 1, 0, ...Array(rows.length - 1).fill([]));
    }

    // 4. Điền dữ liệu vào từng hàng sinh viên
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

        // Thay {{>students.stt}} và {{students.xxx}} bằng giá trị thực
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

        if (filled === "") {
          cell.value = null;
        } else if (!isNaN(Number(filled)) && filled !== "") {
          cell.value = Number(filled);
        } else {
          cell.value = filled;
        }
      });
    });

    // Nếu không có sinh viên: xóa hàng template
    if (rows.length === 0) {
      tmplRow.eachCell((cell) => { cell.value = null; });
    }
  }

  // 5. Thay thế các placeholder đơn {{var}} còn lại (phong, ngay, ten...)
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && cell.value.includes("{{")) {
        cell.value = cell.value.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
          return String(vars[key] ?? "");
        });
      }
    });
  });
}

/** Phát hiện sheet dựa trên nội dung placeholder */
function sheetContains(ws: ExcelJS.Worksheet, keyword: string): boolean {
  let found = false;
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (typeof cell.value === "string" && cell.value.includes(keyword)) {
        found = true;
      }
    });
  });
  return found;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const committee = await db.committees.findByTopic(topicId);
  if (!committee) return new NextResponse("Not found", { status: 404 });

  if (committee.secretary_id !== session.user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const allAssignments = await db.committeeTopics.filter({ committee_id: committee.id });
  const topicIds = allAssignments.map((a) => a.topic_id);

  const scorerIds = [
    committee.chair_id,
    committee.member_1_id,
    committee.member_2_id,
    committee.member_3_id,
    committee.member_4_id,
    committee.member_5_id,
  ].filter(Boolean) as string[];

  const [scorerUsers, chairUser, secretaryUser, member1User, member2User] = await Promise.all([
    Promise.all(scorerIds.map((id) => db.users.findById(id))),
    db.users.findById(committee.chair_id),
    db.users.findById(committee.secretary_id),
    committee.member_1_id ? db.users.findById(committee.member_1_id) : Promise.resolve(null),
    committee.member_2_id ? db.users.findById(committee.member_2_id) : Promise.resolve(null),
  ]);

  const scorers = scorerIds.map((id, i) => ({
    id,
    name: scorerUsers[i]?.full_name ?? "—",
  }));

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
      const committeeScores = allScores.filter((s) => s.score_role === "COMMITTEE_MEMBER");

      const scoreByMember: Record<string, number | null> = {};
      for (const m of scorers) {
        const sc = committeeScores.find((s) => s.scorer_id === m.id);
        scoreByMember[m.id] = sc != null ? Number(sc.score_value) : null;
      }

      const hdVals = scorers
        .map((m) => scoreByMember[m.id])
        .filter((v): v is number => v !== null);
      const hdAvg = hdVals.length > 0 ? hdVals.reduce((a, b) => a + b, 0) / hdVals.length : null;
      const total = calculateTotalScore(
        svScore ? Number(svScore.score_value) : undefined,
        pbScore ? Number(pbScore.score_value) : undefined,
        hdVals
      );

      return { stt: idx + 1, mssv: student?.student_code ?? "—", ho_va_ten: student?.full_name ?? "—",
        svScore: svScore ? Number(svScore.score_value) : null, pbScore: pbScore ? Number(pbScore.score_value) : null,
        scoreByMember, hdAvg, total };
    })
  );
  const rows = rowsRaw.filter(Boolean) as NonNullable<(typeof rowsRaw)[0]>[];

  const defDate = committee.defense_date ? new Date(committee.defense_date) : new Date();
  const commonVars = {
    phong: committee.committee_name ?? "",
    ngay: defDate.getDate(),
    thang: defDate.getMonth() + 1,
    nam: defDate.getFullYear(),
    ten_chu_tich: chairUser?.full_name ?? "—",
    ten_thu_ky: secretaryUser?.full_name ?? "—",
    ten_thanh_vien_1: member1User?.full_name ?? "—",
    ten_thanh_vien_2: member2User?.full_name ?? "—",
  };

  const diemHdVars = { ...commonVars, member1: scorers[0]?.name ?? "", member2: scorers[1]?.name ?? "", member3: scorers[2]?.name ?? "" };

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

  // Đọc template và xử lý
  const templatePath = path.join(process.cwd(), "public/templates/bang_diem_hd.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  for (const ws of wb.worksheets) {
    if (sheetContains(ws, "member1")) {
      // Sheet ĐIỂM HỘI ĐỒNG
      await processSheet(ws, diemHdVars, diemHdRows);
    } else {
      // Sheet TỔNG HỢP HỘI ĐỒNG
      await processSheet(ws, commonVars, tongHopRows);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = encodeURIComponent(`Diem_HD_${committee.committee_name ?? topicId}`);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}.xlsx`,
    },
  });
}
