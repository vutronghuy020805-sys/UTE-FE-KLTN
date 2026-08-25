"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import {
  batchApproveSupervisorAction,
  batchRejectSupervisorAction,
  updateTopicTitleAction,
  approveSupervisorAction,
  rejectSupervisorAction,
} from "@/app/actions/topic.actions";
import { CheckCircle2, XCircle, Pencil, Check, X, ChevronDown } from "lucide-react";
import type { Topic, User } from "@/types";

type PendingTopic = Topic & { student?: Omit<User, "password_hash"> | null };

export function PendingApprovalTable({ topics }: { topics: PendingTopic[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>(
    Object.fromEntries(topics.map((t) => [t.id, t.title])),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<"batch" | string | null>(null);
  const [loading, setLoading] = useState(false);

  if (topics.length === 0) return null;

  const allSelected = selected.size === topics.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(topics.map((t) => t.id)));
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  async function saveTitle(topicId: string) {
    const newTitle = titles[topicId]?.trim();
    const original = topics.find((t) => t.id === topicId)?.title ?? "";
    if (!newTitle || newTitle === original) { setEditing(null); return; }
    const result = await updateTopicTitleAction(topicId, newTitle);
    if (result.success) { toast("Đã cập nhật tên đề tài", "success"); router.refresh(); }
    else toast(result.error, "error");
    setEditing(null);
  }

  async function handleBatchApprove() {
    if (selected.size === 0) { toast("Chưa chọn đề tài nào", "error"); return; }
    setLoading(true);
    const result = await batchApproveSupervisorAction([...selected]);
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã đồng ý", "success");
      setSelected(new Set());
      router.refresh();
    } else toast(result.error, "error");
  }

  async function handleBatchReject() {
    if (!rejectReason.trim()) { toast("Vui lòng nhập lý do từ chối", "error"); return; }
    setLoading(true);
    const ids = showRejectModal === "batch" ? [...selected] : [showRejectModal as string];
    const result = await batchRejectSupervisorAction(ids, rejectReason.trim());
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã từ chối", "success");
      setSelected(new Set());
      setShowRejectModal(null);
      setRejectReason("");
      router.refresh();
    } else toast(result.error, "error");
  }

  async function handleApproveOne(topicId: string) {
    setLoading(true);
    const result = await approveSupervisorAction(topicId);
    setLoading(false);
    if (result.success) { toast(result.message ?? "Đã đồng ý", "success"); router.refresh(); }
    else toast(result.error, "error");
  }

  return (
    <>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
            <span className="text-sm text-slate-600">
              {selected.size > 0 ? `Đã chọn ${selected.size}/${topics.length}` : `${topics.length} đề tài chờ duyệt`}
            </span>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchApprove}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đồng ý ({selected.size})
              </button>
              <button
                onClick={() => { setShowRejectModal("batch"); setRejectReason(""); }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <XCircle className="w-3.5 h-3.5" />
                Không đồng ý ({selected.size})
              </button>
            </div>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {topics.map((topic) => {
            const isSelected = selected.has(topic.id);
            const isEditing = editing === topic.id;
            return (
              <div key={topic.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(topic.id)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer mt-1 shrink-0"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Tên đề tài — có thể chỉnh sửa */}
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={titles[topic.id] ?? ""}
                        onChange={(e) => setTitles({ ...titles, [topic.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle(topic.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button onClick={() => saveTitle(topic.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <p className="text-sm font-medium text-slate-800 truncate">{titles[topic.id]}</p>
                      <button
                        onClick={() => setEditing(topic.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="Sửa tên đề tài"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs text-slate-500">
                      {topic.student?.full_name ?? "—"} • {topic.student?.student_code ?? ""}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      topic.topic_type === "BCTT"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>{topic.topic_type}</span>
                    {topic.topic_type === "BCTT" && topic.company_name && (
                      <span className="text-xs text-slate-400 italic">🏢 {topic.company_name}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveOne(topic.id)}
                    disabled={loading}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đồng ý
                  </button>
                  <button
                    onClick={() => { setShowRejectModal(topic.id); setRejectReason(""); }}
                    disabled={loading}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Không đồng ý
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal từ chối */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Từ chối{" "}
              {showRejectModal === "batch"
                ? `${selected.size} đề tài đã chọn`
                : `đề tài của ${topics.find((t) => t.id === showRejectModal)?.student?.full_name ?? "sinh viên"}`}
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối để thông báo cho sinh viên..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(""); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleBatchReject}
                disabled={loading || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
