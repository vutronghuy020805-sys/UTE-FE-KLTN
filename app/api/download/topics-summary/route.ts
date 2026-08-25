import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { filterTopicsByDeanMajor } from "@/lib/permissions";
import { KLTN_STATUS_LABELS, BCTT_STATUS_LABELS } from "@/lib/constants";
import type { KltnStatus, BcttStatus } from "@/types";
import ExcelJS from "exceljs";

function fmtDateVN(s: string): string {
  if (!s) return "";
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function sessionLabel(s: string): string {
  if (s === "MORNING") return "Sáng (7h30)";
  if (s === "AFTERNOON") return "Chiều (13h30)";
  return "";
}

function statusLabel(status: string, type: string): string {
  if (type === "BCTT") return BCTT_STATUS_LABELS[status as BcttStatus] ?? status;
  return KLTN_STATUS_LABELS[status as KltnStatus] ?? status;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.system_role?.toUpperCase();
  if (role !== "DEAN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [allTopicsRawAll, allUsers, allCommittees, allCommitteeTopics] = await Promise.all([
    db.topics.getAll() as Promise<Record<string, string>[]>,
    db.users.getAll() as Promise<Record<string, string>[]>,
    db.committees.getAll().catch(() => [] as Record<string, string>[]),
    db.committeeTopics.getAll().catch(() => [] as Record<string, string>[]),
  ]);

  const allTopicsRaw = await filterTopicsByDeanMajor(allTopicsRawAll);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const committeeMap = new Map(allCommittees.map((c) => [c.id, c]));

  const topicToCommittee = new Map<string, Record<string, string>>();
  for (const a of allCommitteeTopics) {
    const c = committeeMap.get(a.committee_id);
    if (c) topicToCommittee.set(a.topic_id, c);
  }

  // Build rows sort theo Hội đồng → tên đề tài
  const rows = allTopicsRaw.map((t) => {
    const student = t.student_id ? userMap.get(t.student_id) : null;
    const supervisor = t.supervisor_id ? userMap.get(t.supervisor_id) : null;
    const reviewer = t.reviewer_id ? userMap.get(t.reviewer_id) : null;
    const committee = topicToCommittee.get(t.id);
    return {
      topic_type: t.topic_type ?? "",
      title: t.title ?? "",
      student_name: student?.full_name ?? "",
      student_code: student?.student_code ?? "",
      supervisor_name: supervisor?.full_name ?? "",
      reviewer_name: reviewer?.full_name ?? "",
      status_label: statusLabel(t.current_status, t.topic_type),
      committee_name: committee?.committee_name ?? "",
      defense_date: committee?.defense_date ?? "",
      defense_session: committee?.defense_session ?? "",
      defense_location: committee?.defense_location ?? "",
    };
  });

  rows.sort((a, b) => {
    if (a.committee_name && !b.committee_name) return -1;
    if (!a.committee_name && b.committee_name) return 1;
    if (a.committee_name !== b.committee_name) return a.committee_name.localeCompare(b.committee_name, "vi");
    return a.title.localeCompare(b.title, "vi");
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hệ thống KLTN";
  wb.created = new Date(0);
  const ws = wb.addWorksheet("Tổng hợp đề tài", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Loại", key: "topic_type", width: 7 },
    { header: "Tên đề tài", key: "title", width: 55 },
    { header: "Sinh viên", key: "student_name", width: 22 },
    { header: "MSSV", key: "student_code", width: 12 },
    { header: "GVHD", key: "supervisor_name", width: 22 },
    { header: "GVPB", key: "reviewer_name", width: 22 },
    { header: "Hội đồng", key: "committee_name", width: 18 },
    { header: "Ngày bảo vệ", key: "defense_date", width: 14 },
    { header: "Buổi", key: "defense_session", width: 14 },
    { header: "Phòng", key: "defense_location", width: 12 },
    { header: "Trạng thái", key: "status_label", width: 30 },
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 24;

  rows.forEach((r, i) => {
    ws.addRow({
      stt: i + 1,
      topic_type: r.topic_type,
      title: r.title,
      student_name: r.student_name,
      student_code: r.student_code,
      supervisor_name: r.supervisor_name,
      reviewer_name: r.reviewer_name,
      committee_name: r.committee_name,
      defense_date: fmtDateVN(r.defense_date),
      defense_session: sessionLabel(r.defense_session),
      defense_location: r.defense_location,
      status_label: r.status_label,
    });
  });

  // Border + wrap cho data rows
  for (let i = 2; i <= rows.length + 1; i++) {
    const row = ws.getRow(i);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const filename = `tong-hop-de-tai-hoi-dong-${dateStr}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
