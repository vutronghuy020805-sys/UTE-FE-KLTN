"use client";

import { useState, useMemo } from "react";
import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { PASSING_SCORE } from "@/lib/constants";
import { CheckCircle2, XCircle, Search, X, BarChart3 } from "lucide-react";

export interface StatRow {
  topicId: string;
  batchKey: string;
  academic_year: string;
  semester: string;
  batch: string;
  current_status: string;
  studentName: string;
  studentCode: string;
  title: string;
  supervisorName: string;
  svScore: number | null;
  pbScore: number | null;
  hdAvg: number | null;
  total: number | null;
}

interface Props {
  allRows: StatRow[];
  batchKeys: string[];
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-slate-300">—</span>;
  return <span className="font-semibold text-slate-800">{Number(value).toFixed(1)}</span>;
}

function TopicStatusCell({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    CHO_CHAM_PHAN_BIEN:  { label: "Chờ PB chấm",       color: "bg-amber-50 text-amber-700 border-amber-200" },
    DA_CHAM_PHAN_BIEN:   { label: "PB đã chấm",         color: "bg-blue-50 text-blue-700 border-blue-200" },
    CHO_HOI_DONG:        { label: "Chờ bảo vệ",         color: "bg-slate-100 text-slate-600 border-slate-200" },
    DANG_CHAM_HOI_DONG:  { label: "Đang bảo vệ",        color: "bg-blue-100 text-blue-700 border-blue-200" },
    CAN_CHINH_SUA:       { label: "Cần chỉnh sửa",      color: "bg-orange-50 text-orange-700 border-orange-200" },
    CHO_GVHD_XAC_NHAN:  { label: "Chờ GVHD xác nhận",  color: "bg-amber-50 text-amber-700 border-amber-200" },
    CHO_CHU_TICH_DUYET:  { label: "Chờ Chủ tịch",       color: "bg-purple-50 text-purple-700 border-purple-200" },
    HOAN_TAT:            { label: "Hoàn tất",            color: "bg-green-50 text-green-700 border-green-200" },
  };
  const info = map[status];
  if (!info) return <span className="text-xs text-slate-400">{status}</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

function BatchScoreTable({ rows, showBatch = false }: { rows: StatRow[]; showBatch?: boolean }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-400 py-6">Không có sinh viên nào phù hợp</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <Thead>
          <tr>
            <Th>#</Th>
            {showBatch && <Th>Đợt</Th>}
            <Th>Sinh viên</Th>
            <Th>MSSV</Th>
            <Th>Tên đề tài</Th>
            <Th>GVHD</Th>
            <Th>GVHD (20%)</Th>
            <Th>GVPB (20%)</Th>
            <Th>HĐ TB (60%)</Th>
            <Th>Điểm tổng</Th>
            <Th>Kết quả</Th>
            <Th>Trạng thái</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((r, idx) => {
            const passed = r.total !== null && r.total >= PASSING_SCORE;
            const isFinished = r.current_status === "HOAN_TAT";
            return (
              <Tr key={r.topicId}>
                <Td><span className="text-xs text-slate-400">{idx + 1}</span></Td>
                {showBatch && (
                  <Td>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {r.academic_year} · HK{r.semester} · Đ{r.batch}
                    </span>
                  </Td>
                )}
                <Td><p className="font-medium text-slate-800">{r.studentName}</p></Td>
                <Td><span className="text-slate-600">{r.studentCode}</span></Td>
                <Td>
                  <p className="text-sm text-slate-700 max-w-48 truncate" title={r.title}>{r.title}</p>
                </Td>
                <Td><p className="text-sm text-slate-600">{r.supervisorName}</p></Td>
                <Td><ScoreCell value={r.svScore} /></Td>
                <Td><ScoreCell value={r.pbScore} /></Td>
                <Td><ScoreCell value={r.hdAvg} /></Td>
                <Td>
                  {r.total !== null ? (
                    <span className={`font-bold text-base ${passed ? "text-green-700" : "text-red-600"}`}>
                      {r.total.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">Chưa đủ</span>
                  )}
                </Td>
                <Td>
                  {isFinished && r.total !== null ? (
                    passed ? (
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Đạt
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                        <XCircle className="w-3 h-3" /> Không đạt
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </Td>
                <Td><TopicStatusCell status={r.current_status} /></Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Card>
  );
}

export function StatisticsFilterTable({ allRows, batchKeys }: Props) {
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [resultFilter, setResultFilter] = useState(""); // "" | "PASS" | "FAIL"

  const isFiltered = !!(search || batchFilter || resultFilter);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (batchFilter && r.batchKey !== batchFilter) return false;
      if (resultFilter === "PASS" && !(r.total !== null && r.total >= PASSING_SCORE)) return false;
      if (resultFilter === "FAIL" && !(r.current_status === "HOAN_TAT" && r.total !== null && r.total < PASSING_SCORE)) return false;
      if (q) {
        const inName = r.studentName.toLowerCase().includes(q);
        const inCode = r.studentCode.toLowerCase().includes(q);
        if (!inName && !inCode) return false;
      }
      return true;
    });
  }, [allRows, search, batchFilter, resultFilter]);

  // Build grouped batches from filtered rows
  const groupedBatches = useMemo(() => {
    const keysToShow = batchFilter ? [batchFilter] : batchKeys;
    return keysToShow.map((key) => ({
      key,
      rows: filteredRows
        .filter((r) => r.batchKey === key)
        .sort((a, b) => (b.total ?? -1) - (a.total ?? -1)),
    })).filter(({ rows }) => rows.length > 0);
  }, [batchFilter, batchKeys, filteredRows]);

  // When searching without batch filter, show flat sorted list
  const showFlat = isFiltered && !batchFilter;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sinh viên hoặc MSSV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Batch dropdown */}
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
          >
            <option value="">Tất cả đợt</option>
            {batchKeys.map((key) => {
              const [ay, sem, bat] = key.split("|");
              return <option key={key} value={key}>{ay} · HK{sem} · Đợt {bat}</option>;
            })}
          </select>

          {/* Result filter */}
          <div className="flex gap-1.5">
            {[
              { value: "", label: "Tất cả kết quả" },
              { value: "PASS", label: "Đạt" },
              { value: "FAIL", label: "Không đạt" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResultFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  resultFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isFiltered && (
            <button
              onClick={() => { setSearch(""); setBatchFilter(""); setResultFilter(""); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Flat view when searching without batch filter */}
      {showFlat && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 px-1">
            Hiển thị <span className="font-semibold text-slate-600">{filteredRows.length}</span> / {allRows.length} sinh viên
          </p>
          <BatchScoreTable rows={filteredRows.sort((a, b) => (b.total ?? -1) - (a.total ?? -1))} showBatch />
        </div>
      )}

      {/* Grouped by batch */}
      {!showFlat && (
        <>
          {groupedBatches.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center py-12 text-center">
                <BarChart3 className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">
                  {allRows.length === 0 ? "Chưa có dữ liệu điểm" : "Không có kết quả phù hợp"}
                </p>
              </div>
            </Card>
          ) : (
            groupedBatches.map(({ key, rows }) => {
              const [ay, sem, bat] = key.split("|");
              const batchPassed = rows.filter((r) => r.total !== null && r.total >= PASSING_SCORE).length;
              const batchFinished = rows.filter((r) => r.current_status === "HOAN_TAT").length;
              return (
                <div key={key} className="space-y-2">
                  <BatchScoreTable rows={rows} />
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
