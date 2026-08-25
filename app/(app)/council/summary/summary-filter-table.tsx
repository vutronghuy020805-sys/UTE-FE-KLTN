"use client";

import { useState, useMemo } from "react";
import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { TopicStatusBadge } from "@/components/domain/topic-components";
import { PASSING_SCORE, SUPERVISOR_PASSING_SCORE, SUPERVISOR_MAX_SCORE } from "@/lib/constants";
import Link from "next/link";
import { CheckCircle2, Clock, Search, X, AlertCircle } from "lucide-react";

export interface SummaryRow {
  topicId: string;
  title: string;
  committeeName: string;
  orderIndex: number | null;
  studentName: string;
  studentCode: string;
  bothPassed: boolean;
  svScore: number | null;
  pbScore: number | null;
  committeeAvg: number | null;
  totalScore: number | null;
  committeeScoreCount: number;
  memberCount: number;
  currentStatus: string;
}

const SCORE_SPREAD_THRESHOLD = 2;

/** Có chênh lệch > 2 điểm giữa GVHD, GVPB, HĐ không (3 giá trị cùng thang /10) */
function hasScoreDiscrepancy(r: SummaryRow): boolean {
  const vals = [r.svScore, r.pbScore, r.committeeAvg].filter(
    (v): v is number => v !== null && !Number.isNaN(v),
  );
  if (vals.length < 2) return false;
  return Math.max(...vals) - Math.min(...vals) > SCORE_SPREAD_THRESHOLD;
}

interface Props {
  rows: SummaryRow[];
}

type Tab = "all" | "ready" | "waiting";

function ScoreChip({ score, isSupervisor = false }: { score: number | null; isSupervisor?: boolean }) {
  if (score === null) return <span className="text-xs text-slate-400">—</span>;
  const passing = isSupervisor ? score >= SUPERVISOR_PASSING_SCORE : score >= PASSING_SCORE;
  const max = isSupervisor ? SUPERVISOR_MAX_SCORE : 10;
  return (
    <span className={`text-sm font-bold ${passing ? "text-green-600" : "text-red-600"}`}>
      {score.toFixed(1)}
      <span className="text-xs font-normal text-slate-400">/{max}</span>
    </span>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "ready", label: "Sẵn sàng tổng hợp" },
  { value: "waiting", label: "Chờ GVHD / GVPB" },
];

export function SummaryFilterTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "ready" && !r.bothPassed) return false;
      if (tab === "waiting" && r.bothPassed) return false;
      if (q) {
        const inName = r.studentName.toLowerCase().includes(q);
        const inCode = r.studentCode.toLowerCase().includes(q);
        const inTitle = r.title.toLowerCase().includes(q);
        if (!inName && !inCode && !inTitle) return false;
      }
      return true;
    });
  }, [rows, search, tab]);

  const hasFilter = search || tab !== "all";

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-purple-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Bạn chưa là Thư ký hội đồng nào</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          Khi được phân công làm Thư ký, các hồ sơ sẽ hiển thị tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên sinh viên, MSSV hoặc tên đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  tab === t.value
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-purple-400"
                }`}
              >
                {t.label}
                <span className="ml-1.5 opacity-70">
                  ({t.value === "all" ? rows.length : t.value === "ready" ? rows.filter((r) => r.bothPassed).length : rows.filter((r) => !r.bothPassed).length})
                </span>
              </button>
            ))}
          </div>

          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setTab("all"); }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {rows.length} hồ sơ
      </p>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-slate-400 py-8">Không có hồ sơ nào phù hợp</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>STT</Th>
                <Th>Sinh viên</Th>
                <Th>Đề tài</Th>
                <Th>Hội đồng</Th>
                <Th>Điểm GVHD</Th>
                <Th>Điểm GVPB</Th>
                <Th>HĐ đã chấm</Th>
                <Th>Điểm tổng</Th>
                <Th>Trạng thái</Th>
                <Th>Thao tác</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((r) => {
                const discrepancy = hasScoreDiscrepancy(r);
                return (
                <Tr
                  key={r.topicId}
                  className={discrepancy ? "bg-red-50 hover:bg-red-100" : ""}
                >
                  <Td>
                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                      {r.orderIndex !== null ? `#${r.orderIndex}` : "—"}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-medium text-slate-800">{r.studentName}</p>
                    <p className="text-xs text-slate-400">{r.studentCode}</p>
                    {discrepancy && (
                      <p className="text-[10px] text-red-600 mt-0.5 font-medium">
                        ⚠ Chênh lệch &gt; {SCORE_SPREAD_THRESHOLD} điểm
                      </p>
                    )}
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-700 min-w-45">{r.title}</p>
                  </Td>
                  <Td>
                    <p className="text-xs text-slate-600">{r.committeeName}</p>
                  </Td>
                  <Td>
                    {r.svScore !== null ? (
                      <ScoreChip score={r.svScore} isSupervisor />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Clock className="w-3 h-3" /> Chưa chấm
                      </span>
                    )}
                  </Td>
                  <Td>
                    {r.pbScore !== null ? (
                      <ScoreChip score={r.pbScore} />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Clock className="w-3 h-3" /> Chưa chấm
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-700">
                      {r.committeeScoreCount}/{r.memberCount} thành viên
                    </span>
                    {r.committeeScoreCount < r.memberCount && (
                      <p className="text-[10px] text-amber-500 mt-0.5">Chưa đủ</p>
                    )}
                  </Td>
                  <Td>
                    {r.totalScore !== null ? (
                      <span className={`font-bold text-sm ${r.totalScore >= PASSING_SCORE ? "text-green-600" : "text-red-600"}`}>
                        {r.totalScore.toFixed(2)}
                        <span className="text-xs font-normal text-slate-400">/10</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa đủ dữ liệu</span>
                    )}
                  </Td>
                  <Td>
                    {r.currentStatus === "HOAN_TAT" ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất
                      </span>
                    ) : r.memberCount > 0 &&
                      r.committeeScoreCount === r.memberCount &&
                      ["DA_CHAM_PHAN_BIEN", "CHO_HOI_DONG", "DANG_CHAM_HOI_DONG"].includes(
                        r.currentStatus,
                      ) ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Đã chấm xong — chờ thư ký
                      </span>
                    ) : (
                      <TopicStatusBadge status={r.currentStatus} type="KLTN" />
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Link
                        href={`/council/topics/${r.topicId}`}
                        className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap"
                      >
                        Xem chi tiết →
                      </Link>
                      {r.bothPassed && (
                        <Link
                          href={`/council/summary/${r.topicId}`}
                          className="text-xs text-purple-600 hover:underline font-medium whitespace-nowrap"
                        >
                          Tổng hợp điểm →
                        </Link>
                      )}
                    </div>
                  </Td>
                </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
