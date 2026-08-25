"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Calendar, Search, X } from "lucide-react";

export interface CommitteeItem {
  id: string;
  committee_name: string;
  defense_date: string; // "YYYY-MM-DD" or "Chưa xác định"
  defense_session?: string; // "MORNING" | "AFTERNOON" | ""
  defense_location: string;
  chair: { id: string; full_name: string } | null;
  secretary: { id: string; full_name: string } | null;
  members: { id: string; full_name: string }[];
  topicCount: number;
}

interface Props {
  committees: CommitteeItem[];
  sortedDates: string[];
}

function formatDate(date: string) {
  if (date === "Chưa xác định") return date;
  return new Date(date + "T00:00:00").toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CommitteesFilterSection({ committees, sortedDates }: Props) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return committees.filter((c) => {
      if (dateFilter && c.defense_date !== dateFilter) return false;
      if (q) {
        const searchTargets = [
          c.committee_name,
          c.chair?.full_name,
          c.secretary?.full_name,
          ...c.members.map((m) => m.full_name),
        ].filter(Boolean).map((s) => s!.toLowerCase());
        if (!searchTargets.some((s) => s.includes(q))) return false;
      }
      return true;
    });
  }, [committees, search, dateFilter]);

  const hasFilter = search || dateFilter;

  // Re-group filtered committees by date (preserve original sort order)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, CommitteeItem[]>();
    for (const c of filtered) {
      if (!map.has(c.defense_date)) map.set(c.defense_date, []);
      map.get(c.defense_date)!.push(c);
    }
    return sortedDates
      .filter((d) => map.has(d))
      .map((d) => ({ date: d, items: map.get(d)! }));
  }, [filtered, sortedDates]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên giảng viên hoặc tên hội đồng..."
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
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
          >
            <option value="">Tất cả ngày bảo vệ</option>
            {sortedDates.map((d) => (
              <option key={d} value={d}>{formatDate(d)}</option>
            ))}
          </select>

          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setDateFilter(""); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {committees.length} hội đồng
      </p>

      {groupedByDate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          Không tìm thấy hội đồng nào
        </div>
      ) : (
        groupedByDate.map(({ date, items }) => (
          <div key={date} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(date)}
              <span className="text-xs font-normal text-slate-400">({items.length} hội đồng)</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {items.map((c) => (
                <div key={c.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{c.committee_name}</p>
                        {c.defense_session && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            c.defense_session === "MORNING"
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-indigo-50 border-indigo-200 text-indigo-700"
                          }`}>
                            {c.defense_session === "MORNING" ? "Sáng" : "Chiều"}
                          </span>
                        )}
                      </div>
                      {c.defense_location && (
                        <p className="text-xs text-slate-400 mt-0.5">{c.defense_location}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {c.chair && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                            CT: {c.chair.full_name}
                          </span>
                        )}
                        {c.secretary && (
                          <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                            TK: {c.secretary.full_name}
                          </span>
                        )}
                        {c.members.map((m) => (
                          <span key={m.id} className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                            TV: {m.full_name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.topicCount > 0
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {c.topicCount} sinh viên
                      </span>
                      <Link
                        href={`/dean/committees/${c.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Xem & thêm SV →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
