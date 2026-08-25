"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui/index";
import { toast, ToastContainer } from "@/components/ui/index";
import { bulkImportFilesByDeanAction } from "@/app/actions/topic.actions";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import * as ExcelJS from "exceljs";

interface ParsedRow {
  student_code: string;
  kltn_url: string;
  turnitin_url: string;
}

export default function DeanImportFilesPage() {
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

      // ExcelJS cell values có thể là object (hyperlink/rich text)
      function cellText(val: unknown): string {
        if (val == null) return "";
        if (typeof val === "string") return val.trim();
        if (typeof val === "number") return String(val);
        if (typeof val === "object") {
          const obj = val as Record<string, unknown>;
          if ("text" in obj) return String(obj.text ?? "").trim();
          if ("hyperlink" in obj) return String(obj.hyperlink ?? "").trim();
          if ("richText" in obj && Array.isArray(obj.richText)) {
            return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim();
          }
          if ("result" in obj) return String(obj.result ?? "").trim();
        }
        return String(val).trim();
      }

      // Ưu tiên hyperlink nếu cell có hyperlink
      function cellUrl(val: unknown): string {
        if (val && typeof val === "object") {
          const obj = val as Record<string, unknown>;
          if ("hyperlink" in obj && obj.hyperlink) return String(obj.hyperlink).trim();
          if ("text" in obj) return String(obj.text ?? "").trim();
        }
        return cellText(val);
      }

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const vals = Array.isArray(row.values) ? row.values : [];
        const studentCode = cellText(vals[1]);
        const kltnUrl = cellUrl(vals[2]);
        const turnitinUrl = cellUrl(vals[3]);

        if (!studentCode && !kltnUrl && !turnitinUrl) return;

        if (!studentCode) {
          errors.push(`Dòng ${rowNumber}: Thiếu MSSV`);
          return;
        }
        if (!kltnUrl && !turnitinUrl) {
          errors.push(`Dòng ${rowNumber}: Không có link file nào`);
          return;
        }

        parsed.push({
          student_code: studentCode,
          kltn_url: kltnUrl,
          turnitin_url: turnitinUrl,
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

    const res = await bulkImportFilesByDeanAction(rows);
    setLoading(false);

    if (res.success && res.data) {
      setResult(res.data);
      if (res.data.created > 0) {
        toast(`Đã import ${res.data.created} file!`, "success");
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
      { header: "Link file bài làm (KLTN)", key: "kltn_url", width: 60 },
      { header: "Link Turnitin", key: "turnitin_url", width: 60 },
    ];

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
    });

    ws.addRow({
      student_code: "20110001",
      kltn_url: "https://drive.google.com/file/d/ABC123xyz/view",
      turnitin_url: "https://drive.google.com/file/d/XYZ789abc/view",
    });
    ws.addRow({
      student_code: "20110002",
      kltn_url: "https://drive.google.com/file/d/DEF456uvw/view",
      turnitin_url: "",
    });

    wb.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mau-import-file.xlsx";
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
              Import link file hàng loạt
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Mapping link file bài làm & Turnitin có sẵn trên Google Drive vào hệ thống
            </p>
          </div>
        </div>

        <Card title="Bước 1: Tải file mẫu">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                File cần có các cột:{" "}
                <span className="font-semibold">MSSV</span>,{" "}
                <span className="font-semibold">Link file bài làm</span>,{" "}
                <span className="font-semibold">Link Turnitin</span>
              </p>
              <p className="text-xs text-slate-400">
                Mỗi dòng tương ứng 1 sinh viên. Có thể để trống 1 trong 2 link
                nếu chưa có. Hỗ trợ link Google Drive dạng{" "}
                <code className="bg-slate-100 px-1 rounded">
                  drive.google.com/file/d/...
                </code>
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1.5" />
              Tải file mẫu
            </Button>
          </div>
        </Card>

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
            <p className="text-xs text-slate-400 mt-1">Hỗ trợ .xlsx, .csv</p>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              onChange={onSelect}
              className="hidden"
            />
          </div>
        </Card>

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
                      Link bài làm
                    </th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">
                      Link Turnitin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-mono">{r.student_code}</td>
                      <td className="px-3 py-2 max-w-[200px]">
                        {r.kltn_url ? (
                          <a
                            href={r.kltn_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{r.kltn_url}</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        {r.turnitin_url ? (
                          <a
                            href={r.turnitin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{r.turnitin_url}</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
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

              <Button
                onClick={handleImport}
                loading={loading}
                disabled={result !== null}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Import {rows.length} dòng
              </Button>
            </div>
          </Card>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            {result.created > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-700">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Đã import thành công {result.created} file
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
