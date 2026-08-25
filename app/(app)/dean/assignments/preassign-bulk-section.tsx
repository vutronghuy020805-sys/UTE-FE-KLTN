"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { preassignReviewerAction, bulkPreassignReviewerAction, autoDistributePreassignAction } from "@/app/actions/topic.actions";
import { Shuffle, ChevronDown, ChevronUp } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  student_code?: string;
  department?: string;
  preassigned: Record<string, string> | null;
}

interface Props {
  students: Student[];
  lecturers: { value: string; label: string }[];
  academicYear: string;
  semester: string;
  emailToName: Record<string, string>;
}

export function PreassignBulkSection({ students, lecturers, academicYear, semester, emailToName }: Props) {
  const router = useRouter();

  // --- Bulk manual ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEmail, setBulkEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [individualEmails, setIndividualEmails] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.id, s.preassigned?.reviewer_email ?? ""]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  // --- Auto distribute ---
  const [showAuto, setShowAuto] = useState(false);
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set());
  const [reviewerSearch, setReviewerSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [distributing, setDistributing] = useState(false);

  const filteredLecturers = useMemo(
    () => lecturers.filter((l) => l.label.toLowerCase().includes(reviewerSearch.toLowerCase())),
    [lecturers, reviewerSearch]
  );

  const targetStudents = useMemo(
    () => onlyUnassigned ? students.filter((s) => !s.preassigned?.reviewer_email) : students,
    [students, onlyUnassigned]
  );

  const perReviewer = selectedReviewers.size > 0
    ? Math.ceil(targetStudents.length / selectedReviewers.size)
    : 0;

  const toggleReviewer = (email: string) => {
    setSelectedReviewers((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const handleAutoDistribute = async () => {
    if (selectedReviewers.size === 0) { toast("Chưa chọn GVPB nào", "error"); return; }
    if (targetStudents.length === 0) { toast("Không có sinh viên để phân công", "error"); return; }
    setDistributing(true);
    const result = await autoDistributePreassignAction(
      targetStudents.map((s) => s.id),
      Array.from(selectedReviewers),
      academicYear,
      semester,
    );
    setDistributing(false);
    if (result.success) {
      toast(result.message ?? "Đã phân công", "success");
      setShowAuto(false);
      setSelectedReviewers(new Set());
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  };

  // --- Manual bulk ---
  const allChecked = selected.size === students.length && students.length > 0;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(students.map((s) => s.id)));
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkSave = async () => {
    if (!bulkEmail) { toast("Vui lòng chọn GVPB", "error"); return; }
    if (selected.size === 0) { toast("Chưa chọn sinh viên nào", "error"); return; }
    setSaving(true);
    const result = await bulkPreassignReviewerAction(Array.from(selected), bulkEmail, academicYear, semester);
    setSaving(false);
    if (result.success) {
      toast(result.message ?? "Đã lưu", "success");
      setSelected(new Set());
      setBulkEmail("");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  };

  const handleIndividualSave = async (studentId: string) => {
    const email = individualEmails[studentId];
    if (!email) { toast("Vui lòng chọn GVPB", "error"); return; }
    setSavingId(studentId);
    const result = await preassignReviewerAction(studentId, email, academicYear, semester);
    setSavingId(null);
    if (result.success) {
      toast(result.message ?? "Đã lưu", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <div className="space-y-3">

      {/* Panel phân công tự động */}
      <div className="border border-purple-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAuto((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-800">Phân công tự động</span>
            <span className="text-xs text-purple-500">— chọn nhiều GVPB, hệ thống chia đều sinh viên</span>
          </div>
          {showAuto ? <ChevronUp className="w-4 h-4 text-purple-500" /> : <ChevronDown className="w-4 h-4 text-purple-500" />}
        </button>

        {showAuto && (
          <div className="p-4 bg-white space-y-4">
            {/* Chọn giảng viên */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Chọn Giảng viên Phản biện:</p>
              <input
                type="text"
                placeholder="Tìm kiếm giảng viên..."
                value={reviewerSearch}
                onChange={(e) => setReviewerSearch(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2">
                {filteredLecturers.map((l) => (
                  <label
                    key={l.value}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      selectedReviewers.has(l.value) ? "bg-purple-100 text-purple-800" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedReviewers.has(l.value)}
                      onChange={() => toggleReviewer(l.value)}
                      className="w-3.5 h-3.5 rounded text-purple-600"
                    />
                    <span className="truncate">{l.label}</span>
                  </label>
                ))}
                {filteredLecturers.length === 0 && (
                  <p className="text-xs text-slate-400 col-span-3 text-center py-2">Không tìm thấy</p>
                )}
              </div>
            </div>

            {/* Tuỳ chọn + preview */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => setOnlyUnassigned(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                Chỉ chia sinh viên chưa có GVPB
              </label>

              {selectedReviewers.size > 0 && (
                <div className="text-sm text-slate-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                  <span className="font-semibold text-purple-700">{targetStudents.length} SV</span>
                  {" ÷ "}
                  <span className="font-semibold text-purple-700">{selectedReviewers.size} GVPB</span>
                  {" ≈ "}
                  <span className="font-semibold text-purple-700">~{perReviewer} SV/GVPB</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAutoDistribute}
                disabled={distributing || selectedReviewers.size === 0 || targetStudents.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Shuffle className="w-4 h-4" />
                {distributing ? "Đang phân công..." : "Phân công tự động"}
              </button>
              {selectedReviewers.size === 0 && (
                <p className="text-xs text-slate-400">Chọn ít nhất 1 GVPB để bắt đầu</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar (manual) */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-800">Đã chọn {selected.size} sinh viên</span>
          <select
            value={bulkEmail}
            onChange={(e) => setBulkEmail(e.target.value)}
            className="text-sm border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] bg-white"
          >
            <option value="">-- Chọn GVPB --</option>
            {lecturers.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button
            onClick={handleBulkSave}
            disabled={saving || !bulkEmail}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? "Đang lưu..." : `Lưu cho ${selected.size} sinh viên`}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline">
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* Bảng sinh viên */}
      <Table>
        <Thead>
          <tr>
            <Th>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </Th>
            <Th>Sinh viên</Th>
            <Th>MSSV</Th>
            <Th>Ngành</Th>
            <Th>GVPB đã phân công</Th>
            <Th>Chọn GVPB (riêng lẻ)</Th>
          </tr>
        </Thead>
        <Tbody>
          {students.map((s) => {
            const preassignedEmail = s.preassigned?.reviewer_email ?? "";
            const preassignedName = preassignedEmail ? (emailToName[preassignedEmail.toLowerCase()] ?? preassignedEmail) : null;
            return (
              <Tr key={s.id} className={selected.has(s.id) ? "bg-blue-50" : ""}>
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </Td>
                <Td><p className="font-medium text-slate-800">{s.full_name}</p></Td>
                <Td><span className="text-slate-600">{s.student_code ?? "—"}</span></Td>
                <Td><span className="text-xs text-slate-500">{s.department ?? "—"}</span></Td>
                <Td>
                  {preassignedName ? (
                    <span className="text-sm text-green-700 font-medium">✓ {preassignedName}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa phân công</span>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <select
                      value={individualEmails[s.id] ?? ""}
                      onChange={(e) => setIndividualEmails((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                    >
                      <option value="">-- Chọn GVPB --</option>
                      {lecturers.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleIndividualSave(s.id)}
                      disabled={savingId === s.id || !individualEmails[s.id]}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {savingId === s.id ? "..." : "Lưu"}
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}
