"use client";

import { useState, useMemo } from "react";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { Table, Thead, Tbody, Th, Td, Tr, EmptyState } from "@/components/ui/index";
import { formatDate } from "@/lib/utils";
import { BookOpen, Plus, Search, X, ChevronDown, Upload, FileUp, FileSpreadsheet } from "lucide-react";
import { DeleteTopicButton } from "./delete-topic-button";
import Link from "next/link";

interface Topic {
  id: string;
  title: string;
  field: string;
  topic_type: string;
  current_status: string;
  created_at: string;
  student: { full_name: string; student_code: string } | null;
  supervisor: { id: string; full_name: string } | null;
  reviewer: { full_name: string } | null;
  gvhdFailed?: boolean;
  committee: {
    id: string;
    name: string;
    defense_date: string;
    defense_session: string;
    defense_location: string;
  } | null;
}

interface Props {
  topics: Topic[];
  supervisors: { id: string; full_name: string }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "TRẠNG THÁI" },
  { value: "CHO_GVHD_DUYET", label: "Chờ GVHD xác nhận" },
  { value: "DANG_THUC_HIEN", label: "Đang thực hiện" },
  { value: "DA_NOP_BAI", label: "Đã nộp bài" },
  { value: "DA_NOP_BAO_CAO", label: "Đã nộp báo cáo" },
  { value: "CHO_CHAM_HUONG_DAN", label: "Chờ chấm GVHD" },
  { value: "DA_CHAM_HUONG_DAN", label: "Qua GVHD" },
  { value: "CHO_CHAM_PHAN_BIEN", label: "Chờ phản biện" },
  { value: "DA_CHAM_PHAN_BIEN", label: "Qua phản biện" },
  { value: "CHO_HOI_DONG", label: "Chờ hội đồng" },
  { value: "DANG_CHAM_HOI_DONG", label: "Đang chấm hội đồng" },
  { value: "CAN_CHINH_SUA", label: "Cần chỉnh sửa" },
  { value: "HOAN_TAT", label: "Hoàn tất" },
];

const TYPE_OPTIONS = [
  { value: "", label: "LOẠI" },
  { value: "KLTN", label: "KLTN" },
  { value: "BCTT", label: "BCTT" },
];

export function TopicsFilterTable({ topics, supervisors }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filteredList = topics.filter((t) => {
      if (statusFilter && t.current_status !== statusFilter) return false;
      if (typeFilter && t.topic_type !== typeFilter) return false;
      if (q) {
        const inTitle = t.title.toLowerCase().includes(q);
        const inName = t.student?.full_name.toLowerCase().includes(q) ?? false;
        const inCode = t.student?.student_code.toLowerCase().includes(q) ?? false;
        if (!inTitle && !inName && !inCode) return false;
      }
      return true;
    });
    // Sort theo Hội đồng (đề tài chưa có HĐ xuống cuối), rồi theo ngày tạo mới nhất
    return [...filteredList].sort((a, b) => {
      const ca = a.committee?.name ?? "";
      const cb = b.committee?.name ?? "";
      if (ca && !cb) return -1;
      if (!ca && cb) return 1;
      if (ca !== cb) return ca.localeCompare(cb, "vi");
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [topics, search, statusFilter, typeFilter]);

  const hasFilter = search || statusFilter || typeFilter;

  return (
    <div className="space-y-3">
      {/* Search + count + nút tạo mới */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sinh viên, MSSV hoặc tên đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {hasFilter && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); }}
            className="shrink-0 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1 bg-white"
          >
            <X className="w-3.5 h-3.5" /> Xoá bộ lọc
          </button>
        )}

        <p className="shrink-0 text-xs text-slate-400">
          <span className="font-semibold text-slate-600">{filtered.length}</span> / {topics.length} đề tài
        </p>

        <a
          href="/api/download/topics-summary"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-amber-200 text-amber-600 text-xs font-medium rounded-lg hover:bg-amber-50 transition-colors"
          title="Xuất file Excel tổng hợp đề tài + hội đồng"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Excel
        </a>

        <Link
          href="/dean/topics/import"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Import đề tài
        </Link>

        <Link
          href="/dean/topics/import-files"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-emerald-200 text-emerald-600 text-xs font-medium rounded-lg hover:bg-emerald-50 transition-colors"
        >
          <FileUp className="w-3.5 h-3.5" /> Import file
        </Link>

        <Link
          href="/dean/topics/create"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Tạo đề tài mới
        </Link>
      </div>

      {/* ── Bảng ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <EmptyState icon={<BookOpen className="w-7 h-7 text-slate-400" />} title="Không có đề tài nào" description="Thử thay đổi bộ lọc" />
        </div>
      ) : (
        <Table>
            <Thead>
              <tr>
                <Th>Đề tài</Th>
                <Th>GVHD</Th>
                <Th>GVPB</Th>
                <Th className="min-w-16">
                  <div className="relative inline-flex items-center">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer focus:outline-none"
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </Th>
                <Th>Hội đồng</Th>
                <Th className="min-w-37">
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="appearance-none bg-transparent w-full pr-5 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer focus:outline-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </Th>
                <Th>Thao tác</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium leading-snug ${t.gvhdFailed ? "text-red-600" : "text-slate-800"}`}>{t.title}</p>
                      {t.gvhdFailed && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          GVHD &lt; 5
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.student?.full_name ?? "—"}
                      {t.student?.student_code ? ` · ${t.student.student_code}` : ""}
                      {` · ${formatDate(t.created_at)}`}
                    </p>
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-600 whitespace-nowrap">{t.supervisor?.full_name ?? "—"}</p>
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-600 whitespace-nowrap">{t.reviewer?.full_name ?? "—"}</p>
                  </Td>
                  <Td>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full whitespace-nowrap">
                      {t.topic_type}
                    </span>
                  </Td>
                  <Td>
                    {t.committee ? (
                      <p className="text-xs text-slate-700 whitespace-nowrap" title={t.committee.name}>
                        {t.committee.name}
                      </p>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </Td>
                  <Td>
                    <TopicStatusBadge status={t.current_status} type={t.topic_type as "KLTN" | "BCTT"} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {t.current_status === "DA_CHAM_HUONG_DAN" && (
                        <a href="/dean/assignments" className="text-xs text-purple-600 hover:underline font-medium whitespace-nowrap">
                          Phân công PB
                        </a>
                      )}
                      {t.current_status === "DA_CHAM_PHAN_BIEN" && (
                        <a href="/dean/committees" className="text-xs text-purple-600 hover:underline font-medium whitespace-nowrap">
                          Phân công HĐ
                        </a>
                      )}
                      <DeleteTopicButton topicId={t.id} title={t.title} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
        </Table>
      )}
    </div>
  );
}
