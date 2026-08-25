"use client";

import { useState, useMemo } from "react";
import { Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import Link from "next/link";
import { Search, X, Pencil } from "lucide-react";

interface ReviewerTopic {
  id: string;
  title: string;
  topic_type: string;
  current_status: string;
  supervisorScore: number | null;
  myScore: number | null;
  student: {
    full_name: string;
    student_code: string;
    department: string;
    major: string;
  } | null;
}

interface Props {
  topics: ReviewerTopic[];
}

const SCORED_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "scored", label: "Đã chấm" },
  { value: "unscored", label: "Chưa chấm" },
];

export function ReviewerFilterTable({ topics }: Props) {
  const [search, setSearch] = useState("");
  const [scoredFilter, setScoredFilter] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (scoredFilter === "scored" && t.myScore === null) return false;
      if (scoredFilter === "unscored" && t.myScore !== null) return false;
      if (q) {
        const inName = t.student?.full_name.toLowerCase().includes(q) ?? false;
        const inCode = t.student?.student_code.toLowerCase().includes(q) ?? false;
        const inTitle = t.title.toLowerCase().includes(q);
        if (!inName && !inCode && !inTitle) return false;
      }
      return true;
    });
  }, [topics, search, scoredFilter]);

  const hasFilter = search || scoredFilter;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên SV, MSSV hoặc tên đề tài..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={scoredFilter}
            onChange={(e) => setScoredFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {SCORED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {" "}({opt.value === "" ? topics.length
                  : opt.value === "scored" ? topics.filter((t) => t.myScore !== null).length
                  : topics.filter((t) => t.myScore === null).length})
              </option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setScoredFilter(""); }}
              className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {topics.length} hồ sơ
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[70vh]">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Không có kết quả phù hợp</div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Sinh viên</Th>
                <Th>Khoa / Ngành</Th>
                <Th>Đề tài</Th>
                <Th>Loại</Th>
                <Th><div className="flex justify-center">Điểm PB</div></Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <p className="font-medium text-slate-800 whitespace-nowrap">{t.student?.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{t.student?.student_code}</p>
                  </Td>
                  <Td>
                    <p className="text-slate-600">{t.student?.department || "—"}</p>
                    <p className="text-xs text-slate-400">{t.student?.major || ""}</p>
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-700">{t.title}</p>
                  </Td>
                  <Td>
                    <span className="text-xs font-semibold text-slate-600">{t.topic_type}</span>
                  </Td>
                  <Td>
                    <div className="flex justify-center">
                      <Link
                        href={`/reviewer/topics/${t.id}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors group"
                        title={t.myScore !== null ? "Cập nhật điểm" : "Nhập điểm"}
                      >
                        {t.myScore !== null ? (
                          <span className={`text-sm font-bold ${t.myScore > 5 ? "text-green-600" : "text-red-600"}`}>
                            {t.myScore.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                      </Link>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
