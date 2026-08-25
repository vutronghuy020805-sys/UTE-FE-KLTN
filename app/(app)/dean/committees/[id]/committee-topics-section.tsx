"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Button } from "@/components/ui/index";
import {
  addTopicsToCommitteeAction,
  removeTopicFromCommitteeAction,
  reorderCommitteeTopicsAction,
} from "@/app/actions/topic.actions";
import {
  Sparkles,
  UserCheck,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";

interface AssignedTopic {
  assignmentId: string;
  topic: Record<string, string>;
  student: Record<string, string> | null;
  supervisor: Record<string, string> | null;
  reviewer: Record<string, string> | null;
  gvhdFailed?: boolean;
  gvhdScore?: number;
  gvpbScore?: number;
}

interface PendingTopic {
  id: string;
  title: string;
  student: Record<string, string> | null;
  supervisor: Record<string, string> | null;
  reviewer: Record<string, string> | null;
  isSuggested: boolean;
  isAutoPass?: boolean;
  gvhdFailed?: boolean;
  gvhdScore?: number;
  gvpbScore?: number;
  [key: string]: unknown;
}

function ScoreCell({ score, failed }: { score: number | undefined; failed?: boolean }) {
  if (score === undefined) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <span className={`font-bold tabular-nums ${failed ? "text-red-600" : score >= 5 ? "text-green-700" : "text-slate-700"}`}>
      {score.toFixed(1)}
    </span>
  );
}


interface Props {
  committeeId: string;
  assignedTopics: AssignedTopic[];
  pendingTopics: PendingTopic[];
}

export function CommitteeTopicsSection({ committeeId, assignedTopics, pendingTopics }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(pendingTopics.filter((t) => t.isSuggested).map((t) => t.id))
  );
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Thứ tự thuyết trình — bản local để cập nhật optimistic
  const [orderedTopics, setOrderedTopics] = useState<AssignedTopic[]>(assignedTopics);
  const [reordering, setReordering] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Đồng bộ khi dữ liệu từ server đổi (ví dụ sau khi add/remove)
  useEffect(() => {
    setOrderedTopics(assignedTopics);
  }, [assignedTopics]);

  async function persistOrder(next: AssignedTopic[]) {
    setOrderedTopics(next);
    setReordering(true);
    const ids = next.map((t) => t.assignmentId);
    const result = await reorderCommitteeTopicsAction(committeeId, ids);
    setReordering(false);
    if (!result.success) {
      toast(result.error ?? "Không cập nhật được thứ tự", "error");
      setOrderedTopics(assignedTopics);
    }
  }

  function moveItem(from: number, to: number) {
    if (from === to || to < 0 || to >= orderedTopics.length) return;
    const next = [...orderedTopics];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(targetIndex: number) {
    if (dragIndex === null) return;
    const from = dragIndex;
    setDragIndex(null);
    moveItem(from, targetIndex);
  }

  const suggested = pendingTopics.filter((t) => t.isSuggested);
  const others = pendingTopics.filter((t) => !t.isSuggested);
  const displayedOthers = showAll ? others : others.slice(0, 5);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  async function handleAdd() {
    if (selected.size === 0) { toast("Chưa chọn đề tài nào", "error"); return; }
    setLoading(true);
    const result = await addTopicsToCommitteeAction(committeeId, Array.from(selected));
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã thêm sinh viên!", "success");
      setSelected(new Set());
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleRemove(assignmentId: string, topicId: string) {
    setRemovingId(assignmentId);
    const result = await removeTopicFromCommitteeAction(assignmentId, topicId);
    setRemovingId(null);
    if (result.success) {
      toast("Đã xóa khỏi hội đồng", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Sinh viên đã trong HĐ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-green-500" />
            Sinh viên trong hội đồng
            <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              {assignedTopics.length}
            </span>
          </h2>
        </div>

        {orderedTopics.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
            Chưa có sinh viên nào. Thêm từ danh sách bên dưới.
          </p>
        ) : (
          <>
            {orderedTopics.length > 1 && (
              <p className="text-xs text-slate-500 mb-2">
                Kéo thả hoặc dùng mũi tên <ArrowUp className="inline w-3 h-3" />/<ArrowDown className="inline w-3 h-3" /> để đổi thứ tự thuyết trình
                {reordering && <span className="ml-2 text-amber-600">(đang lưu…)</span>}
              </p>
            )}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header cột điểm */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                <div className="w-6 shrink-0" />
                <div className="flex-1" />
                <div className="w-14 text-center">GVHD</div>
                <div className="w-14 text-center">GVPB</div>
                <div className="w-22 shrink-0" />
              </div>
              <div className="divide-y divide-slate-100">
                {orderedTopics.map(({ assignmentId, topic, student, supervisor, reviewer, gvhdFailed, gvhdScore, gvpbScore }, index) => (
                  <div
                    key={assignmentId}
                    draggable={!reordering}
                    onDragStart={() => onDragStart(index)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                    className={`flex items-start gap-2 p-3 bg-white transition-colors ${
                      dragIndex === index ? "opacity-50" : ""
                    } ${reordering ? "cursor-wait" : "cursor-grab active:cursor-grabbing"}`}
                  >
                    <div className="shrink-0 w-6 flex flex-col items-center gap-0.5 pt-0.5">
                      <GripVertical className="w-4 h-4 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600 tabular-nums">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${gvhdFailed ? "text-red-600" : "text-slate-900"}`}>{topic.title}</p>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        <span className="text-xs text-slate-500">SV: {student?.full_name}{student?.student_code ? ` (${student.student_code})` : ""}</span>
                        <span className="text-xs text-slate-400">GVHD: {supervisor?.full_name ?? "—"}</span>
                        <span className="text-xs text-slate-400">GVPB: {reviewer?.full_name ?? "—"}</span>
                      </div>
                    </div>
                    <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                      <ScoreCell score={gvhdScore} failed={gvhdFailed} />
                    </div>
                    <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                      <ScoreCell score={gvpbScore} />
                    </div>
                    <div className="shrink-0 w-22 flex items-center gap-0.5 justify-end">
                      <button
                        onClick={() => moveItem(index, index - 1)}
                        disabled={index === 0 || reordering}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveItem(index, index + 1)}
                        disabled={index === orderedTopics.length - 1 || reordering}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemove(assignmentId, topic.id)}
                        disabled={removingId === assignmentId}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Xóa khỏi hội đồng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Thêm sinh viên */}
      {pendingTopics.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              Thêm sinh viên vào hội đồng
            </h2>
            {selected.size > 0 && (
              <Button onClick={handleAdd} loading={loading} size="sm">
                Thêm {selected.size} SV đã chọn
              </Button>
            )}
          </div>

          {/* Auto-suggest */}
          {suggested.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Gợi ý tự động ({suggested.length}) — GVPB có trong hội đồng này
                </p>
                <button
                  className="text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => toggleAll(suggested.map((t) => t.id))}
                >
                  {suggested.every((t) => selected.has(t.id)) ? "Bỏ chọn tất cả" : "Chọn tất cả gợi ý"}
                </button>
              </div>
              <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-1.5 bg-amber-100/60 border-b border-amber-200 text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                  <div className="w-4 shrink-0" />
                  <div className="flex-1" />
                  <div className="w-14 text-center">GVHD</div>
                  <div className="w-14 text-center">GVPB</div>
                </div>
                <div className="divide-y divide-amber-100">
                  {suggested.map((t) => (
                    <label key={t.id} className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${selected.has(t.id) ? "bg-amber-100" : "hover:bg-amber-100"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="w-4 h-4 mt-0.5 shrink-0 rounded border-amber-300 text-amber-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${t.gvhdFailed ? "text-red-600" : "text-slate-900"}`}>{t.title}</p>
                        <div className="flex flex-wrap gap-x-3 mt-0.5">
                          <span className="text-xs text-slate-600">SV: {t.student?.full_name}{t.student?.student_code ? ` (${t.student.student_code})` : ""}</span>
                          <span className="text-xs text-amber-700 font-medium">GVPB: {t.reviewer?.full_name ?? "—"}</span>
                        </div>
                      </div>
                      <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                        <ScoreCell score={t.gvhdScore} failed={t.gvhdFailed} />
                      </div>
                      <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                        <ScoreCell score={t.gvpbScore} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Các đề tài khác */}
          {others.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Đề tài khác chờ xếp hội đồng ({others.length})</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="w-4 shrink-0" />
                  <div className="flex-1" />
                  <div className="w-14 text-center">GVHD</div>
                  <div className="w-14 text-center">GVPB</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {displayedOthers.map((t) => (
                    <label key={t.id} className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${selected.has(t.id) ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="w-4 h-4 mt-0.5 shrink-0 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${t.gvhdFailed ? "text-red-600" : "text-slate-900"}`}>{t.title}</p>
                        <div className="flex flex-wrap gap-x-3 mt-0.5">
                          <span className="text-xs text-slate-500">SV: {t.student?.full_name}{t.student?.student_code ? ` (${t.student.student_code})` : ""}</span>
                          <span className="text-xs text-slate-400">GVHD: {t.supervisor?.full_name ?? "—"}</span>
                          <span className="text-xs text-slate-400">GVPB: {t.reviewer?.full_name ?? "—"}</span>
                        </div>
                      </div>
                      <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                        <ScoreCell score={t.gvhdScore} failed={t.gvhdFailed} />
                      </div>
                      <div className="w-14 shrink-0 text-center text-sm pt-0.5">
                        <ScoreCell score={t.gvpbScore} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {others.length > 5 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-2"
                >
                  {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</> : <><ChevronDown className="w-3.5 h-3.5" /> Xem thêm {others.length - 5} đề tài</>}
                </button>
              )}
            </div>
          )}

          {selected.size > 0 && (
            <div className="mt-3">
              <Button onClick={handleAdd} loading={loading} className="w-full">
                Thêm {selected.size} sinh viên vào hội đồng
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
