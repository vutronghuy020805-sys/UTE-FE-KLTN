"use client";

import { useState, useMemo } from "react";
import { Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { formatDate } from "@/lib/utils";
import { X } from "lucide-react";
import { SetActiveButton, EditDeadlineButton } from "./create-term-button";

interface Term {
  id: string;
  academic_year: string;
  semester: string;
  batch: string;
  bctt_deadline: string;
  kltn_deadline: string;
  is_active: string;
}

interface Props {
  terms: Term[];
}

function DeadlineBadge({ date }: { date: string }) {
  const deadline = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isPast = diffDays < 0;
  const isSoon = diffDays >= 0 && diffDays <= 7;

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      isPast ? "bg-red-100 text-red-700" :
      isSoon ? "bg-amber-100 text-amber-700" :
      "bg-slate-100 text-slate-600"
    }`}>
      {formatDate(date)}
      {isPast && " (Đã qua)"}
      {isSoon && ` (Còn ${diffDays}d)`}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Không hoạt động" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  { value: "BCTT", label: "Có hạn BCTT" },
  { value: "KLTN", label: "Có hạn KLTN" },
];

export function TermsFilterTable({ terms }: Props) {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    return terms.filter((t) => {
      if (statusFilter === "active" && t.is_active !== "true") return false;
      if (statusFilter === "inactive" && t.is_active === "true") return false;
      if (typeFilter === "BCTT" && !t.bctt_deadline) return false;
      if (typeFilter === "KLTN" && !t.kltn_deadline) return false;
      return true;
    });
  }, [terms, statusFilter, typeFilter]);

  const hasFilter = statusFilter || typeFilter;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status filter */}
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Type filter */}
          <div className="flex gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  typeFilter === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasFilter && (
            <button
              onClick={() => { setStatusFilter(""); setTypeFilter(""); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {terms.length} học kỳ
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <Thead>
            <tr>
              <Th>Năm học</Th>
              <Th>Học kỳ</Th>
              <Th>Đợt</Th>
              <Th>Hạn nộp BCTT</Th>
              <Th>Hạn nộp KLTN</Th>
              <Th>Trạng thái</Th>
              <Th>Thao tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  Không có kết quả phù hợp
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <Tr key={t.id}>
                  <Td><p className="font-semibold text-slate-800">{t.academic_year}</p></Td>
                  <Td><p className="text-slate-700">Học kỳ {t.semester}</p></Td>
                  <Td><p className="text-slate-700">Đợt {t.batch}</p></Td>
                  <Td>
                    {t.bctt_deadline ? (
                      <DeadlineBadge date={t.bctt_deadline} />
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa đặt</span>
                    )}
                  </Td>
                  <Td>
                    {t.kltn_deadline ? (
                      <DeadlineBadge date={t.kltn_deadline} />
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa đặt</span>
                    )}
                  </Td>
                  <Td>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      t.is_active === "true"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {t.is_active === "true" ? "✓ Đang hoạt động" : "Không hoạt động"}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1.5">
                      {t.is_active !== "true" && <SetActiveButton termId={t.id} />}
                      <EditDeadlineButton
                        termId={t.id}
                        bcttDeadline={t.bctt_deadline}
                        kltnDeadline={t.kltn_deadline}
                      />
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
