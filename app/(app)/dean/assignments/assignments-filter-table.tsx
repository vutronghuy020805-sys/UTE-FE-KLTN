"use client";

import { useState, useMemo } from "react";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { Card } from "@/components/ui/index";
import { Search, X } from "lucide-react";

interface AssignedTopic {
  id: string;
  title: string;
  academic_year: string;
  semester: string;
  batch: string;
  current_status: string;
  topic_type: string;
  student: { full_name: string; student_code: string } | null;
  supervisor: { full_name: string } | null;
  reviewer: { id: string; full_name: string } | null;
}

interface Props {
  topics: AssignedTopic[];
  reviewers: { id: string; full_name: string }[];
}

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "DANG_THUC_HIEN", label: "Đang thực hiện" },
  { value: "CHO_CHAM_HUONG_DAN", label: "Chờ GVHD chấm" },
  { value: "DA_CHAM_HUONG_DAN", label: "GVHD đã chấm" },
  { value: "CHO_CHAM_PHAN_BIEN", label: "Chờ phản biện" },
  { value: "DA_CHAM_PHAN_BIEN", label: "PB đã chấm" },
];

export function AssignmentsFilterTable({ topics, reviewers }: Props) {
  const [search, setSearch] = useState("");
  const [gvpbFilter, setGvpbFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (gvpbFilter && t.reviewer?.id !== gvpbFilter) return false;
      if (statusFilter && t.current_status !== statusFilter) return false;
      if (q) {
        const inName = t.student?.full_name.toLowerCase().includes(q) ?? false;
        const inCode = t.student?.student_code.toLowerCase().includes(q) ?? false;
        if (!inName && !inCode) return false;
      }
      return true;
    });
  }, [topics, search, gvpbFilter, statusFilter]);

  const hasFilter = search || gvpbFilter || statusFilter;

  return (
    <div className="space-y-3">
      {/* Filter UI */}
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
          <select
            value={gvpbFilter}
            onChange={(e) => setGvpbFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
          >
            <option value="">Tất cả GVPB</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setGvpbFilter(""); setStatusFilter(""); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {topics.length} đề tài
      </p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Sinh viên</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">MSSV</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Tên đề tài</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Đợt</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">GVHD</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">GVPB</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Không tìm thấy đề tài nào
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <p className="font-medium text-slate-800">{t.student?.full_name ?? "—"}</p>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-slate-600">{t.student?.student_code ?? "—"}</span>
                    </td>
                    <td className="py-2 px-3">
                      <p className="text-slate-700 max-w-50 truncate" title={t.title}>{t.title}</p>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs text-slate-500">{t.academic_year} · HK{t.semester} · Đ{t.batch}</span>
                    </td>
                    <td className="py-2 px-3"><p className="text-slate-600">{t.supervisor?.full_name ?? "—"}</p></td>
                    <td className="py-2 px-3"><p className="font-medium text-slate-800">{t.reviewer?.full_name ?? "—"}</p></td>
                    <td className="py-2 px-3">
                      <TopicStatusBadge status={t.current_status} type={t.topic_type as "KLTN" | "BCTT"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
