"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { Table, Thead, Th } from "@/components/ui/index";
import { approveQuotaAction, updateQuotaAction } from "@/app/actions/user.actions";

interface QuotaRow {
  rowKey: string;
  lecturerId: string;
  trainingSystem: "REGULAR" | "CLC";
  trainingLabel: string;
  lecturerName: string;
  department?: string;
  major?: string;
  email?: string;
  quotaId: string | null;
  quota: number;
  current_count: number;
  is_approved: boolean;
  academicYear: string;
  semester: string;
  batch: string;
  syncedWithTerm: boolean;
}

export function QuotaTableClient({ rows }: { rows: QuotaRow[] }) {
  const router = useRouter();

  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.rowKey, r.is_approved])),
  );
  const [quotaInputs, setQuotaInputs] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.rowKey, r.quota.toString()])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const autoSyncDone = useRef(false);

  // Group rows by lecturerId
  const lecturerIds = [...new Set(rows.map((r) => r.lecturerId))];
  const grouped = lecturerIds.map((id) => rows.filter((r) => r.lecturerId === id));

  const uniqueLecturers = lecturerIds.length;
  const approvedLecturers = lecturerIds.filter((id) =>
    rows.filter((r) => r.lecturerId === id).some((r) => states[r.rowKey]),
  ).length;
  const totalSlots = rows.reduce(
    (s, r) => s + (states[r.rowKey] ? Number(quotaInputs[r.rowKey]) || 0 : 0),
    0,
  );

  useEffect(() => {
    if (autoSyncDone.current) return;
    const unsynced = rows.filter((r) => !r.syncedWithTerm && r.quota > 0);
    if (unsynced.length === 0) return;
    autoSyncDone.current = true;
    (async () => {
      setAutoSyncing(true);
      for (const row of unsynced) {
        const q = parseInt(quotaInputs[row.rowKey]);
        if (isNaN(q) || q <= 0) continue;
        const result = await updateQuotaAction(
          row.lecturerId, q, row.academicYear, row.semester, row.batch,
          row.trainingSystem, row.major,
        );
        if (result.success) {
          setStates((prev) => ({ ...prev, [row.rowKey]: true }));
          setSavedIds((prev) => new Set(prev).add(row.rowKey));
        }
      }
      setAutoSyncing(false);
      router.refresh();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(row: QuotaRow) {
    if (!row.quotaId) { toast("Chưa có hạn mức, vui lòng lưu số SV trước", "error"); return; }
    setTogglingId(row.rowKey);
    const next = !states[row.rowKey];
    const result = await approveQuotaAction(row.quotaId, next);
    setTogglingId(null);
    if (result.success) {
      setStates((prev) => ({ ...prev, [row.rowKey]: next }));
      toast(result.message ?? "Đã cập nhật", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleSave(row: QuotaRow) {
    const q = parseInt(quotaInputs[row.rowKey]);
    if (isNaN(q) || q < 0) { toast("Hạn mức phải là số không âm", "error"); return; }
    setSavingId(row.rowKey);
    const result = await updateQuotaAction(
      row.lecturerId, q, row.academicYear, row.semester, row.batch,
      row.trainingSystem, row.major,
    );
    setSavingId(null);
    if (result.success) {
      if (q > 0) setStates((prev) => ({ ...prev, [row.rowKey]: true }));
      setSavedIds((prev) => new Set(prev).add(row.rowKey));
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleSaveAll() {
    setSavingAll(true);
    let successCount = 0, errorCount = 0;
    for (const row of rows) {
      const q = parseInt(quotaInputs[row.rowKey]);
      if (isNaN(q) || q < 0) { errorCount++; continue; }
      const result = await updateQuotaAction(
        row.lecturerId, q, row.academicYear, row.semester, row.batch,
        row.trainingSystem, row.major,
      );
      if (result.success) {
        if (q > 0) setStates((prev) => ({ ...prev, [row.rowKey]: true }));
        setSavedIds((prev) => new Set(prev).add(row.rowKey));
        successCount++;
      } else { errorCount++; }
    }
    setSavingAll(false);
    if (errorCount === 0) {
      toast(`Đã lưu ${successCount} hạn mức`, "success");
    } else {
      toast(`Lưu ${successCount} thành công, ${errorCount} thất bại`, "error");
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {approvedLecturers}/{uniqueLecturers} GV đã mở ·{" "}
          Tổng {totalSlots} slot
        </p>
        <div className="flex items-center gap-2">
          {autoSyncing && (
            <span className="text-xs text-slate-400 italic">⏳ Đang đồng bộ...</span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={savingAll || autoSyncing}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {savingAll ? "Đang lưu..." : "💾 Lưu tất cả"}
          </button>
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Giảng viên</Th>
            <Th>Đang HD</Th>
            <Th>Hệ đào tạo</Th>
            <Th>Còn lại</Th>
            <Th>Trạng thái</Th>
            <Th>Hạn mức</Th>
          </tr>
        </Thead>
        <tbody>
          {grouped.map((group) => (
            <Fragment key={group[0].lecturerId}>
              {group.map((row, rowIdx) => {
                const approved = states[row.rowKey];
                const remaining = row.quota - row.current_count;
                const isFull = row.quota > 0 && remaining <= 0;
                const isToggling = togglingId === row.rowKey;
                const isSaving = savingId === row.rowKey;
                const isCLC = row.trainingSystem === "CLC";
                const isFirst = rowIdx === 0;
                const isLast = rowIdx === group.length - 1;

                return (
                  <tr
                    key={row.rowKey}
                    className={`${isFirst ? "border-t border-slate-100" : ""} ${
                      isLast ? "border-b border-slate-200" : "border-b border-dashed border-slate-100"
                    }`}
                  >
                    {/* Tên GV — chỉ hiện ở hàng đầu, span toàn bộ group */}
                    {isFirst && (
                      <td
                        rowSpan={group.length}
                        className="px-4 py-3 align-middle border-r border-slate-100"
                      >
                        <p className="font-medium text-slate-800">{row.lecturerName}</p>
                        <p className="text-xs text-slate-400">{row.department}</p>
                        {row.major && <p className="text-xs text-slate-400">{row.major}</p>}
                        <p className="text-xs text-slate-400">{row.email}</p>
                      </td>
                    )}

                    {/* Đang HD */}
                    <td className="px-4 py-2">
                      <span className="font-semibold text-blue-600">{row.current_count}</span>
                    </td>

                    {/* Hệ badge */}
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          isCLC
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.trainingLabel}
                      </span>
                    </td>

                    {/* Còn lại */}
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${isFull ? "text-red-600" : "text-green-600"}`}>
                        {Math.max(0, remaining)}
                      </span>
                      {isFull && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                          Đầy
                        </span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-2">
                      {row.quotaId ? (
                        <button
                          onClick={() => handleToggle(row)}
                          disabled={isToggling}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60 border ${
                            approved
                              ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700 hover:border-red-300 border-green-300"
                              : "bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700 hover:border-green-300 border-red-300"
                          }`}
                        >
                          {isToggling ? "..." : approved ? "✓ Đã mở" : "✕ Đã đóng"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Chưa có</span>
                      )}
                    </td>

                    {/* Cập nhật */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={quotaInputs[row.rowKey]}
                          onChange={(e) =>
                            setQuotaInputs((prev) => ({ ...prev, [row.rowKey]: e.target.value }))
                          }
                          className="w-16 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-400">SV</span>
                        <button
                          onClick={() => {
                            if (savedIds.has(row.rowKey)) {
                              setSavedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(row.rowKey);
                                return next;
                              });
                            } else {
                              handleSave(row);
                            }
                          }}
                          disabled={isSaving}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                            savedIds.has(row.rowKey)
                              ? "bg-green-100 text-green-700 border border-green-300 hover:bg-slate-100 hover:text-slate-600 hover:border-slate-300"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {isSaving ? "..." : savedIds.has(row.rowKey) ? "✓ Đã lưu" : "Lưu"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
