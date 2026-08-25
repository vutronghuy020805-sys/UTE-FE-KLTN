"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast, Button } from "@/components/ui/index";
import {
  saveBienBanHdAction,
  autosaveBienBanHdDraftAction,
} from "@/app/actions/topic.actions";
import { Save, Download, Check, Loader2 } from "lucide-react";

interface Props {
  topicId: string;
  initialNhanXet: string;
  initialYeuCau: string;
  canEdit: boolean;
}

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function BienBanHdForm({ topicId, initialNhanXet, initialYeuCau, canEdit }: Props) {
  const router = useRouter();
  const [nhanXet, setNhanXet] = useState(initialNhanXet);
  const [yeuCau, setYeuCau] = useState(initialYeuCau);
  const [saving, setSaving] = useState(false);

  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");
  const lastSavedRef = useRef({ nhanXet: initialNhanXet, yeuCau: initialYeuCau });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Safari + bộ gõ tiếng Việt (Telex/VNI): trong lúc IME compose, tránh re-render
  // kích hoạt bởi autosave để không hủy composition đang gõ dở.
  const isComposingRef = useRef(false);

  // Autosave debounce 1s sau khi ngừng gõ
  useEffect(() => {
    if (!canEdit) return;
    if (nhanXet === lastSavedRef.current.nhanXet && yeuCau === lastSavedRef.current.yeuCau) {
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Đang compose IME → hoãn autosave, đợi lần effect kế tiếp
      if (isComposingRef.current) return;
      setAutosaveStatus("saving");
      const snapshot = { nhanXet, yeuCau };
      const result = await autosaveBienBanHdDraftAction(topicId, snapshot.nhanXet, snapshot.yeuCau);
      if (result.success) {
        lastSavedRef.current = snapshot;
        setAutosaveStatus("saved");
      } else {
        setAutosaveStatus("error");
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nhanXet, yeuCau, topicId, canEdit]);

  async function handleSave() {
    setSaving(true);
    const result = await saveBienBanHdAction(topicId, nhanXet, yeuCau);
    setSaving(false);
    if (result.success) {
      toast("Đã lưu biên bản", "success");
      lastSavedRef.current = { nhanXet, yeuCau };
      router.push("/council/summary");
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        Điền nội dung bên dưới. Nội dung được lưu tự động. Nhấn "Lưu Biên Bản" khi hoàn tất — sau đó quay về trang tổng hợp để bấm "Xác nhận điểm và gửi BBHD" gửi đồng loạt cho sinh viên.
      </p>

      {/* Nhận xét thành viên */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">
            2. Nhận xét của các thành viên hội đồng
          </label>
          <AutosaveIndicator status={autosaveStatus} />
        </div>
        <textarea
          value={nhanXet}
          onChange={(e) => setNhanXet(e.target.value)}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            setNhanXet(e.currentTarget.value);
          }}
          disabled={!canEdit}
          rows={10}
          placeholder="Nhập nhận xét chung của hội đồng về khóa luận..."
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      {/* Yêu cầu chỉnh sửa */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          3. Yêu cầu chỉnh sửa
          <span className="ml-1 text-xs font-normal text-slate-400">(để trống nếu không yêu cầu chỉnh sửa)</span>
        </label>
        <textarea
          value={yeuCau}
          onChange={(e) => setYeuCau(e.target.value)}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            setYeuCau(e.currentTarget.value);
          }}
          disabled={!canEdit}
          rows={8}
          placeholder="Nhập các yêu cầu chỉnh sửa nếu có..."
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {canEdit && (
          <Button
            leftIcon={Save}
            onClick={handleSave}
            loading={saving}
            className="flex-1"
          >
            Lưu Biên Bản
          </Button>
        )}

        <a
          href={`/api/download/bb-hd/${topicId}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
          title="Tải biên bản Word"
        >
          <Download className="w-4 h-4" />
          Tải biên bản Word
        </a>
      </div>
    </div>
  );
}

function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Đang lưu...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-xs text-green-600 flex items-center gap-1">
        <Check className="w-3 h-3" />
        Đã lưu tự động
      </span>
    );
  }
  return <span className="text-xs text-red-600">Lưu tự động thất bại</span>;
}
