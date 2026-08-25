"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import {
  Search,
  X,
  Pencil,
  Check,
  Loader2,
  Upload,
} from "lucide-react";
import { FileUpload } from "@/components/domain/file-upload";
import type { FileType } from "@/types";

interface StudentTopic {
  id: string;
  title: string;
  topic_type: string;
  current_status: string;
  student: {
    full_name: string;
    email: string;
    student_code: string;
    department: string;
    major: string;
  } | null;
  baiLamUrl: string | null;
  turnitinUrl: string | null;
  baiBaoUrl: string | null;
  supervisorScore: number | undefined;
  supervisorComment: string | undefined;
}

interface Props {
  topics: StudentTopic[];
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DANG_THUC_HIEN", label: "Đang thực hiện" },
  { value: "CHO_CHAM_HUONG_DAN", label: "Chờ chấm" },
  { value: "DA_CHAM_HUONG_DAN", label: "Đã chấm" },
  { value: "CAN_CHINH_SUA", label: "Cần chỉnh sửa" },
  { value: "HOAN_TAT", label: "Hoàn tất" },
];

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({
  topicId,
  fileType,
  label,
  onClose,
  onUploadSuccess,
}: {
  topicId: string;
  fileType: string;
  label: string;
  onClose: () => void;
  onUploadSuccess: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <FileUpload
          topicId={topicId}
          fileType={fileType as FileType}
          onSuccess={() => {
            onUploadSuccess();
            onClose();
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function StudentsFilterTable({ topics }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [titles, setTitles] = useState<Record<string, string>>(
    () => Object.fromEntries(topics.map((t) => [t.id, t.title])),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploadModal, setUploadModal] = useState<{
    topicId: string;
    fileType: string;
    label: string;
  } | null>(null);

  // Track file đã upload để cập nhật icon ngay lập tức
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { baiLam?: boolean; turnitin?: boolean; baiBao?: boolean }>
  >(() =>
    Object.fromEntries(
      topics.map((t) => [
        t.id,
        { baiLam: !!t.baiLamUrl, turnitin: !!t.turnitinUrl, baiBao: !!t.baiBaoUrl },
      ]),
    ),
  );

  function startEdit(id: string) {
    setEditingId(id);
    setEditValue(titles[id] ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === titles[id]) { cancelEdit(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setTitles((prev) => ({ ...prev, [id]: trimmed }));
        setEditingId(null);
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "Lỗi khi lưu");
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (typeFilter && t.topic_type !== typeFilter) return false;
      if (statusFilter && t.current_status !== statusFilter) return false;
      if (q) {
        const inName = t.student?.full_name.toLowerCase().includes(q) ?? false;
        const inTitle = (titles[t.id] ?? t.title).toLowerCase().includes(q);
        if (!inName && !inTitle) return false;
      }
      return true;
    });
  }, [topics, titles, search, typeFilter, statusFilter]);

  return (
    <div className="space-y-3">
      {uploadModal && (
        <UploadModal
          topicId={uploadModal.topicId}
          fileType={uploadModal.fileType}
          label={uploadModal.label}
          onClose={() => setUploadModal(null)}
          onUploadSuccess={() => {
            const { topicId, fileType } = uploadModal;
            setUploadedFiles((prev) => ({
              ...prev,
              [topicId]: {
                ...prev[topicId],
                ...(fileType === "KHOA_LUAN" ? { baiLam: true } : {}),
                ...(fileType === "TURNITIN" ? { turnitin: true } : {}),
                ...(fileType === "BAI_BAO" ? { baiBao: true } : {}),
              },
            }));
          }}
        />
      )}
      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên sinh viên hoặc tên đề tài..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">
        Hiển thị{" "}
        <span className="font-semibold text-slate-600">{filtered.length}</span>{" "}
        / {topics.length} sinh viên
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[70vh]">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Không có kết quả phù hợp
          </div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th className="w-36">Sinh viên</Th>
                <Th className="w-28">Khoa / Ngành</Th>
                <Th className="w-[40%]">Đề tài</Th>
                <Th>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-semibold text-slate-600"
                  >
                    <option value="">Tất cả</option>
                    <option value="KLTN">KLTN</option>
                    <option value="BCTT">BCTT</option>
                  </select>
                </Th>
                <Th><div className="flex justify-center">File bài làm</div></Th>
                <Th><div className="flex justify-center">Turnitin</div></Th>
                <Th><div className="flex justify-center">Bài báo</div></Th>
                <Th><div className="flex justify-center">Điểm</div></Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <p className="font-medium text-slate-800">
                      {t.student?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400">{t.student?.email}</p>
                  </Td>
                  <Td>
                    <p className="text-slate-600">
                      {t.student?.department || "—"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.student?.major || ""}
                    </p>
                  </Td>
                  <Td>
                    {editingId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(t.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          disabled={saving}
                          className="flex-1 text-sm border border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 min-w-0"
                        />
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={saving}
                          className="shrink-0 p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="shrink-0 p-1 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-slate-700 font-medium text-sm">
                          {titles[t.id] ?? t.title}
                        </p>
                        <button
                          onClick={() => startEdit(t.id)}
                          className="shrink-0 p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Chỉnh sửa tên đề tài"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </Td>
                  {/* Loại */}
                  <Td>
                    <span className="text-xs font-semibold text-slate-600">
                      {t.topic_type}
                    </span>
                  </Td>
                  {/* File bài làm */}
                  <Td>
                    <div className="flex justify-center">
                      {t.topic_type === "BCTT" ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <button
                          onClick={() =>
                            setUploadModal({
                              topicId: t.id,
                              fileType: "KHOA_LUAN",
                              label: uploadedFiles[t.id]?.baiLam ? "Cập nhật bài khóa luận" : "Upload bài khóa luận",
                            })
                          }
                          className={`flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-50 transition-colors ${uploadedFiles[t.id]?.baiLam ? "text-blue-600" : "text-slate-400 hover:text-blue-600"}`}
                          title={uploadedFiles[t.id]?.baiLam ? "Nhấn để upload lại" : "Upload file bài làm"}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                  {/* Turnitin */}
                  <Td>
                    <div className="flex justify-center">
                      {t.topic_type === "BCTT" ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <button
                          onClick={() =>
                            setUploadModal({
                              topicId: t.id,
                              fileType: "TURNITIN",
                              label: uploadedFiles[t.id]?.turnitin ? "Cập nhật Turnitin" : "Upload báo cáo Turnitin",
                            })
                          }
                          className={`flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-50 transition-colors ${uploadedFiles[t.id]?.turnitin ? "text-blue-600" : "text-slate-400 hover:text-blue-600"}`}
                          title={uploadedFiles[t.id]?.turnitin ? "Nhấn để upload lại" : "Upload Turnitin"}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                  {/* Bài báo (không bắt buộc) */}
                  <Td>
                    <div className="flex justify-center">
                      {t.topic_type === "BCTT" ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <button
                          onClick={() =>
                            setUploadModal({
                              topicId: t.id,
                              fileType: "BAI_BAO",
                              label: uploadedFiles[t.id]?.baiBao ? "Cập nhật Bài báo" : "Upload Bài báo khoa học (không bắt buộc)",
                            })
                          }
                          className={`flex items-center justify-center p-1.5 rounded-lg hover:bg-blue-50 transition-colors ${uploadedFiles[t.id]?.baiBao ? "text-blue-600" : "text-slate-400 hover:text-blue-600"}`}
                          title={uploadedFiles[t.id]?.baiBao ? "Nhấn để upload lại" : "Upload Bài báo (không bắt buộc)"}
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                  {/* Điểm */}
                  <Td>
                    <div className="flex justify-center">
                    <Link
                      href={`/supervisor/topics/${t.id}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors group"
                      title={t.supervisorScore !== undefined ? "Cập nhật điểm" : "Nhập điểm"}
                    >
                      {t.supervisorScore !== undefined ? (
                        <span className="text-sm font-bold text-blue-700">
                          {t.supervisorScore.toFixed(1)}
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
