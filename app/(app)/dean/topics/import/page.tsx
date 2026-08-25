"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui/index";
import { toast, ToastContainer } from "@/components/ui/index";
import { bulkCreateTopicsByDeanAction } from "@/app/actions/topic.actions";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
} from "lucide-react";
import * as ExcelJS from "exceljs";

interface ParsedRow {
  student_code: string;
  supervisor_email: string;
  reviewer_email: string;
  title: string;
  field: string;
  topic_type: "KLTN" | "BCTT";
}

const FIELD_OPTIONS = [
  "Công nghệ phần mềm",
  "Trí tuệ nhân tạo",
  "Hệ thống thông tin",
  "An toàn thông tin",
  "Mạng máy tính",
  "Khoa học dữ liệu",
  "Khác",
];

export default function DeanImportTopicsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: string[];
  } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    const parsed: ParsedRow[] = [];
    const errors: string[] = [];

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();

      if (file.name.endsWith(".csv")) {
        await workbook.csv.load(buffer);
      } else {
        await workbook.xlsx.load(buffer);
      }

      const sheet = workbook.worksheets[0];
      if (!sheet) {
        setParseErrors(["File không có sheet nào"]);
        return;
      }

      // ExcelJS cell values can be objects (hyperlink, rich text, etc.)
      function cellText(val: unknown): string {
        if (val == null) return "";
        if (typeof val === "string") return val.trim();
        if (typeof val === "number") return String(val);
        if (typeof val === "object") {
          const obj = val as Record<string, unknown>;
          // Hyperlink: { text: "...", hyperlink: "..." }
          if ("text" in obj) return String(obj.text ?? "").trim();
          // Rich text: { richText: [{ text: "..." }] }
          if ("richText" in obj && Array.isArray(obj.richText)) {
            return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim();
          }
          // Formula result
          if ("result" in obj) return String(obj.result ?? "").trim();
        }
        return String(val).trim();
      }

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header

        const vals = Array.isArray(row.values) ? row.values : [];
        const studentCode = cellText(vals[1]);
        const supervisorEmail = cellText(vals[2]);
        const reviewerEmail = cellText(vals[3]);
        const title = cellText(vals[4]);
        const field = cellText(vals[5]);
        const topicTypeRaw = cellText(vals[6]).toUpperCase() || "KLTN";

        if (!studentCode && !supervisorEmail && !title) return; // skip empty rows

        if (!studentCode) {
          errors.push(`Dòng ${rowNumber}: Thiếu MSSV`);
          return;
        }
        if (!supervisorEmail) {
          errors.push(`Dòng ${rowNumber}: Thiếu email GVHD`);
          return;
        }
        if (!title) {
          errors.push(`Dòng ${rowNumber}: Thiếu tên đề tài`);
          return;
        }

        const topicType = topicTypeRaw === "BCTT" ? "BCTT" : "KLTN";

        parsed.push({
          student_code: studentCode,
          supervisor_email: supervisorEmail,
          reviewer_email: reviewerEmail,
          title,
          field: field || "Khác",
          topic_type: topicType,
        });
      });
    } catch {
      errors.push("Không đọc được file. Vui lòng kiểm tra định dạng (xlsx/csv).");
    }

    setRows(parsed);
    setParseErrors(errors);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    setResult(null);

    const res = await bulkCreateTopicsByDeanAction(rows);
    setLoading(false);

    if (res.success && res.data) {
      setResult(res.data);
      if (res.data.created > 0) {
        toast(`Đã tạo ${res.data.created}/${rows.length} đề tài!`, "success");
      }
      if (res.data.errors.length > 0) {
        toast(`${res.data.errors.length} dòng bị lỗi`, "error");
      }
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  function downloadTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Import");

    ws.columns = [
      { header: "MSSV", key: "student_code", width: 15 },
      { header: "Email GVHD", key: "supervisor_email", width: 30 },
      { header: "Email GVPB", key: "reviewer_email", width: 30 },
      { header: "Tên đề tài", key: "title", width: 50 },
      { header: "Lĩnh vực", key: "field", width: 25 },
      { header: "Loại (KLTN/BCTT)", key: "topic_type", width: 18 },
    ];

    // Style header
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
    });

    // Sample rows
    ws.addRow({
      student_code: "20110001",
      supervisor_email: "nguyenvana@hcmute.edu.vn",
      reviewer_email: "lethic@hcmute.edu.vn",
      title: "Xây dựng hệ thống quản lý sinh viên",
      field: "Công nghệ phần mềm",
      topic_type: "KLTN",
    });
    ws.addRow({
      student_code: "20110002",
      supervisor_email: "tranthib@hcmute.edu.vn",
      reviewer_email: "",
      title: "Ứng dụng AI trong nhận dạng hình ảnh",
      field: "Trí tuệ nhân tạo",
      topic_type: "KLTN",
    });

    wb.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mau-import-de-tai.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <>
      <ToastContainer />
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Import đề tài hàng loạt
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload file Excel/CSV để tạo nhiều đề tài cùng lúc
            </p>
          </div>
        </div>

        {/* Template download */}
        <Card title="Bước 1: Tải file mẫu">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                File cần có các cột:{" "}
                <span className="font-semibold">MSSV</span>,{" "}
                <span className="font-semibold">Email GVHD</span>,{" "}
                <span className="font-semibold">Email GVPB</span>{" "}
                <span className="text-slate-400">(tùy chọn)</span>,{" "}
                <span className="font-semibold">Tên đề tài</span>,{" "}
                <span className="font-semibold">Lĩnh vực</span>,{" "}
                <span className="font-semibold">Loại (KLTN/BCTT)</span>
              </p>
              <p className="text-xs text-slate-400">
                Lĩnh vực:{" "}
                {FIELD_OPTIONS.join(", ")}. Nếu để trống mặc định là
                &quot;Khác&quot;. Cột Loại nếu để trống mặc định là KLTN. Cột GVPB để trống nếu chưa phân công.
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1.5" />
              Tải file mẫu
            </Button>
          </div>
        </Card>

        {/* Upload zone */}
        <Card title="Bước 2: Upload file" className="mt-4">
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-600 font-medium">
              Kéo thả file vào đây hoặc bấm để chọn
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hỗ trợ .xlsx, .csv
            </p>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              onChange={onSelect}
              className="hidden"
            />
          </div>
        </Card>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Lỗi khi đọc file ({parseErrors.length})
            </p>
            <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
              {parseErrors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <Card
            title={`Bước 3: Xem trước & Import (${rows.length} dòng)`}
            className="mt-4"
          >
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      #
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      MSSV
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Email GVHD
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Email GVPB
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Tên đề tài
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Lĩnh vực
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Loại
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-mono">{r.student_code}</td>
                      <td className="px-3 py-2">{r.supervisor_email}</td>
                      <td className="px-3 py-2 text-slate-400">{r.reviewer_email || "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {r.title}
                      </td>
                      <td className="px-3 py-2">{r.field}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            r.topic_type === "KLTN"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {r.topic_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setRows([]);
                  setParseErrors([]);
                  setResult(null);
                }}
                className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa dữ liệu
              </button>

              <Button onClick={handleImport} loading={loading} disabled={result !== null}>
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Import {rows.length} đề tài
              </Button>
            </div>
          </Card>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 space-y-3">
            {result.created > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-700">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Đã tạo thành công {result.created}/{rows.length} đề tài
                </p>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 mb-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {result.errors.length} dòng bị lỗi
                </p>
                <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/dean/topics")}>
                Về danh sách đề tài
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setParseErrors([]);
                  setResult(null);
                  const input = document.getElementById("file-input") as HTMLInputElement;
                  if (input) input.value = "";
                }}
              >
                Import thêm
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
