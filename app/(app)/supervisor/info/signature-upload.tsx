"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { uploadSignatureAction, deleteSignatureAction } from "@/app/actions/user.actions";
import { Upload, Trash2, PenLine } from "lucide-react";

interface Props {
  currentSignatureUrl?: string;
  currentFileId?: string;
}

/**
 * Chuyển URL dạng "https://drive.google.com/file/d/{id}/view"
 * thành dạng trực tiếp hiển thị ảnh "https://drive.google.com/uc?id={id}"
 */
function toDisplayUrl(url?: string, fileId?: string): string {
  if (fileId) return `https://drive.google.com/uc?id=${fileId}`;
  if (!url) return "";
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?id=${m[1]}`;
  return url;
}

export function SignatureUpload({ currentSignatureUrl, currentFileId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = toDisplayUrl(currentSignatureUrl, currentFileId);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast("File phải là ảnh (PNG, JPG)", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Ảnh tối đa 2MB", "error");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await uploadSignatureAction(formData);
    setLoading(false);

    if (res.success) {
      toast(res.message ?? "Đã cập nhật chữ ký", "success");
      setPreview(null);
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
      setPreview(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Xóa chữ ký hiện tại?")) return;
    setLoading(true);
    const res = await deleteSignatureAction();
    setLoading(false);
    if (res.success) {
      toast("Đã xóa chữ ký", "success");
      router.refresh();
    } else {
      toast(res.error ?? "Lỗi", "error");
    }
  }

  return (
    <Card title="Chữ ký điện tử">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="shrink-0">
          <div className="w-48 h-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
            ) : displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayUrl} alt="chữ ký" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center text-slate-400">
                <PenLine className="w-8 h-8 mx-auto mb-1" />
                <p className="text-xs">Chưa có chữ ký</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-2">
          <p className="text-sm text-slate-600">
            Upload ảnh chữ ký (PNG/JPG, tối đa 2MB) để tự động chèn vào các
            biên bản Word khi tải về.
          </p>
          <p className="text-xs text-slate-400">
            Khuyến nghị: ảnh có nền trong suốt (PNG), kích thước ~400×200px.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {currentFileId ? "Đổi chữ ký" : "Upload chữ ký"}
            </Button>
            {currentFileId && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Xóa
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
