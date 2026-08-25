"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Calendar,
  Send,
  X,
  ChevronDown,
  Users,
  Star,
  Shield,
  BookOpen,
  ClipboardCheck,
  Crown,
} from "lucide-react";
import {
  createComposeReminderAction,
  type ComposeRecipientGroup,
} from "@/app/actions/reminder.actions";
import { toast } from "@/components/ui/index";

interface Props {
  kltnDeadline: string | null;
  bcttDeadline: string | null;
  ungradedSupervisorCount: number;
  ungradedReviewerCount: number;
  bcttStudentCount: number;
  pendingRevisionGVHDCount: number;
  pendingChairCount: number;
}

type GroupDef = {
  id: ComposeRecipientGroup;
  label: string;
  shortLabel: string;
  icon: typeof Users;
  chip: string;
  count: (p: Props) => number | null;
};

const GROUPS: GroupDef[] = [
  {
    id: "GVHD_HD",
    label: "GVHD chấm điểm hướng dẫn",
    shortLabel: "GVHD chấm điểm HD",
    icon: Users,
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    count: (p) => p.ungradedSupervisorCount,
  },
  {
    id: "GVPB_PB",
    label: "GVPB chấm điểm phản biện",
    shortLabel: "GVPB chấm điểm PB",
    icon: Star,
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    count: (p) => p.ungradedReviewerCount,
  },
  {
    id: "HD_MEMBER",
    label: "Thành viên Hội đồng (theo ngày HĐ)",
    shortLabel: "Thành viên HĐ",
    icon: Shield,
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    count: () => null,
  },
  {
    id: "BCTT_SV",
    label: "Sinh viên đăng ký BCTT",
    shortLabel: "SV BCTT",
    icon: BookOpen,
    chip: "bg-green-50 text-green-700 border-green-200",
    count: (p) => p.bcttStudentCount,
  },
  {
    id: "REVISION_GVHD",
    label: "GVHD duyệt chỉnh sửa sau bảo vệ",
    shortLabel: "GVHD duyệt chỉnh sửa",
    icon: ClipboardCheck,
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    count: (p) => p.pendingRevisionGVHDCount,
  },
  {
    id: "CHAIR_FINAL",
    label: "Chủ tịch HĐ phê duyệt cuối cùng",
    shortLabel: "CT HĐ phê duyệt cuối",
    icon: Crown,
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    count: (p) => p.pendingChairCount,
  },
];

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function AutoReminderCards(props: Props) {
  const router = useRouter();

  const [selected, setSelected] = useState<ComposeRecipientGroup[]>([]);
  const [councilDate, setCouncilDate] = useState("");
  const [remindBeforeDays, setRemindBeforeDays] = useState("");
  const [remindOn, setRemindOn] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const needCouncilDate = selected.includes("HD_MEMBER");

  const totalCount = useMemo(() => {
    return selected.reduce((sum, id) => {
      const g = GROUPS.find((x) => x.id === id);
      const c = g?.count(props);
      return sum + (c ?? 0);
    }, 0);
  }, [selected, props]);

  function toggleGroup(id: ComposeRecipientGroup) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function removeGroup(id: ComposeRecipientGroup) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  const daysNum = Number.parseInt(remindBeforeDays, 10);
  const hasBeforeDays = remindBeforeDays !== "" && Number.isFinite(daysNum) && daysNum > 0;

  const computedBeforeDate = useMemo(() => {
    if (!hasBeforeDays || !remindOn) return "";
    const d = new Date(remindOn);
    d.setDate(d.getDate() - daysNum);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [hasBeforeDays, daysNum, remindOn]);

  async function handleSend() {
    if (selected.length === 0) {
      toast("Vui lòng chọn ít nhất 1 đối tượng", "error");
      return;
    }
    if (!remindOn && !hasBeforeDays) {
      toast("Vui lòng nhập 'Ngày nhắc' hoặc số ngày nhắc trước", "error");
      return;
    }
    if (hasBeforeDays && !remindOn) {
      toast("Cần chọn 'Ngày nhắc' để tính ngày nhắc trước", "error");
      return;
    }
    if (!title.trim()) {
      toast("Vui lòng nhập tiêu đề", "error");
      return;
    }
    if (!content.trim()) {
      toast("Vui lòng nhập nội dung", "error");
      return;
    }
    if (needCouncilDate && !councilDate) {
      toast("Vui lòng chọn 'Ngày Hội đồng' cho nhóm Thành viên HĐ", "error");
      return;
    }

    setLoading(true);
    const res = await createComposeReminderAction({
      recipientGroups: selected,
      councilDate: councilDate || undefined,
      title,
      content,
      remindBeforeDate: computedBeforeDate || undefined,
      remindOnDate: remindOn || undefined,
    });
    setLoading(false);

    if (res.success) {
      const data = res.data as { emailCount: number; groups: number };
      toast(`Đã tạo nhắc hạn — sẽ gửi tới ${data.emailCount} người (${data.groups} đối tượng)!`, "success");
      setSelected([]);
      setTitle("");
      setContent("");
      setRemindBeforeDays("");
      setRemindOn("");
      setCouncilDate("");
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-visible">
      {/* Header — title trái, lịch nhắc phải */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Soạn nhắc hạn</h2>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <label className="text-xs text-slate-600 whitespace-nowrap">Nhắc trước</label>
            <input
              type="number"
              min={1}
              max={365}
              value={remindBeforeDays}
              onChange={(e) => setRemindBeforeDays(e.target.value)}
              placeholder="0"
              className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white w-14 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600">
              ngày
              {computedBeforeDate && (
                <span className="text-slate-400"> ({fmt(computedBeforeDate)})</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <label className="text-xs text-slate-600 whitespace-nowrap">Ngày nhắc:</label>
            <input
              type="date"
              value={remindOn}
              onChange={(e) => setRemindOn(e.target.value)}
              className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Đến — multi-select chips */}
      <div className="px-4 py-2.5 border-b border-slate-100 relative">
        <div className="flex items-start gap-3">
          <label className="text-sm text-slate-500 w-14 shrink-0 pt-1.5">Đến</label>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-8">
            {selected.map((id) => {
              const g = GROUPS.find((x) => x.id === id)!;
              const Icon = g.icon;
              const count = g.count(props);
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${g.chip}`}
                >
                  <Icon className="w-3 h-3" />
                  {g.shortLabel}
                  {count !== null && <span className="opacity-70">({count})</span>}
                  <button
                    type="button"
                    onClick={() => removeGroup(id)}
                    className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-full border border-dashed border-blue-300"
              >
                {selected.length === 0 ? "Chọn đối tượng" : "Thêm"}
                <ChevronDown className="w-3 h-3" />
              </button>

              {pickerOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1.5">
                  {GROUPS.map((g) => {
                    const Icon = g.icon;
                    const checked = selected.includes(g.id);
                    const count = g.count(props);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                          checked ? "bg-blue-50/60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="w-3.5 h-3.5 accent-blue-600 pointer-events-none"
                        />
                        <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="flex-1 text-slate-700">{g.label}</span>
                        {count !== null && (
                          <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ngày Hội đồng — chỉ hiện khi nhóm HD_MEMBER được chọn */}
      {needCouncilDate && (
        <div className="px-4 py-2 border-b border-slate-100 bg-purple-50/40 flex items-center gap-3 flex-wrap">
          <label className="text-xs text-purple-700 font-medium">
            Ngày Hội đồng (cho nhóm Thành viên HĐ):
          </label>
          <input
            type="date"
            value={councilDate}
            onChange={(e) => setCouncilDate(e.target.value)}
            className="text-xs border border-purple-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          {councilDate && (
            <span className="text-xs text-purple-500">
              Hệ thống tự lấy email tất cả thành viên HĐ được xếp lịch ngày này
            </span>
          )}
        </div>
      )}

      {/* Tiêu đề */}
      <div className="px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-500 w-14 shrink-0">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập tiêu đề nhắc hạn..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Nội dung */}
      <div className="px-4 py-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Nhập nội dung email..."
          className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-slate-400 leading-relaxed"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || selected.length === 0}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? "Đang tạo..." : "Tạo nhắc hạn"}
        </button>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>
            Hạn KLTN: <span className="font-medium text-slate-700">{fmt(props.kltnDeadline)}</span>
          </span>
          <span>•</span>
          <span>
            Hạn BCTT: <span className="font-medium text-slate-700">{fmt(props.bcttDeadline)}</span>
          </span>
          {selected.length > 0 && (
            <>
              <span>•</span>
              <span>
                {selected.length} đối tượng
                {totalCount > 0 && (
                  <>
                    {" "}~ <span className="font-medium text-slate-700">{totalCount}</span> người nhận
                  </>
                )}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
