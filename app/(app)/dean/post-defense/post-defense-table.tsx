"use client";

import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ApprovalState = "approved" | "pending" | "waiting";

export interface PostDefenseRow {
  topicId: string;
  studentName: string;
  studentCode: string;
  academicYear: string;
  semester: string;
  batch: string;
  total: number | null;
  supervisorName: string;
  chairName: string;
  gvhdState: ApprovalState;
  chairState: ApprovalState;
  chinhSuaUrl: string | null;
  chinhSuaName: string | null;
  chinhSuaUploadedAt: string | null;
  giaiTrinhUrl: string | null;
  giaiTrinhName: string | null;
  giaiTrinhUploadedAt: string | null;
}

function approvalClass(state: ApprovalState): string {
  if (state === "approved") return "text-green-600";
  if (state === "pending") return "text-red-500";
  return "text-slate-400"; // waiting
}

function approvalTitle(state: ApprovalState): string {
  if (state === "approved") return "Đã duyệt";
  if (state === "pending") return "Đến lượt duyệt — chưa làm";
  return "Chưa đến lượt duyệt";
}

interface Props {
  rows: PostDefenseRow[];
}

function FileCell({ url, name, uploadedAt }: {
  url: string | null; name: string | null; uploadedAt: string | null;
}) {
  if (!url) {
    return <span className="text-xs text-slate-300">— Chưa nộp —</span>;
  }
  return (
    <div className="flex items-start gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 w-8 h-8 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors"
        title={name ?? "Tải file"}
      >
        <FileText className="w-4 h-4 text-blue-600" />
      </a>
      <div className="min-w-0">
        <p className="text-xs text-slate-700 truncate max-w-[180px]" title={name ?? undefined}>
          {name ?? "—"}
        </p>
        {uploadedAt && (
          <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(uploadedAt)}</p>
        )}
      </div>
    </div>
  );
}

export function PostDefenseTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-400 py-8">
          Chưa có sinh viên nào ở giai đoạn sau bảo vệ.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <Thead>
          <tr>
            <Th>Sinh viên</Th>
            <Th>BB HĐ</Th>
            <Th>Bài chỉnh sửa</Th>
            <Th>BB giải trình</Th>
            <Th>Đợt</Th>
            <Th>Điểm</Th>
            <Th>GVHD</Th>
            <Th>CTHĐ</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.topicId}>
              <Td>
                <p className="font-medium text-slate-800">{r.studentName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{r.studentCode}</p>
              </Td>
              <Td>
                <a
                  href={`/api/download/bb-hd/${r.topicId}`}
                  className="inline-flex items-center justify-center w-9 h-9 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Tải Biên bản hội đồng"
                >
                  <Download className="w-4 h-4 text-purple-600" />
                </a>
              </Td>
              <Td>
                <FileCell
                  url={r.chinhSuaUrl}
                  name={r.chinhSuaName}
                  uploadedAt={r.chinhSuaUploadedAt}
                />
              </Td>
              <Td>
                <FileCell
                  url={r.giaiTrinhUrl}
                  name={r.giaiTrinhName}
                  uploadedAt={r.giaiTrinhUploadedAt}
                />
              </Td>
              <Td>
                <span className="text-xs text-slate-500">
                  {r.academicYear} · HK{r.semester} · Đ{r.batch}
                </span>
              </Td>
              <Td>
                {r.total !== null ? (
                  <span className="font-bold text-slate-800">{r.total.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </Td>
              <Td>
                <p
                  className={`text-sm font-medium ${approvalClass(r.gvhdState)}`}
                  title={approvalTitle(r.gvhdState)}
                >
                  {r.supervisorName}
                </p>
              </Td>
              <Td>
                <p
                  className={`text-sm font-medium ${approvalClass(r.chairState)}`}
                  title={approvalTitle(r.chairState)}
                >
                  {r.chairName}
                </p>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Card>
  );
}
