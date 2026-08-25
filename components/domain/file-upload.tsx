"use client";

import { useState, useRef } from "react";
import { Upload, File, X, Loader2, CheckCircle2 } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { FILE_TYPE_LABELS } from "@/lib/constants";
import type { FileType } from "@/types";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  topicId: string;
  fileType: FileType;
  onSuccess?: (fileUrl: string, fileName: string) => void;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

// Chia file thành chunks 3MB để tránh giới hạn 4MB của Vercel
const CHUNK_SIZE = 3 * 1024 * 1024;

async function uploadChunk(
  uploadUrl: string,
  chunk: Blob,
  start: number,
  end: number,
  total: number,
  isLastChunk: boolean,
  onChunkProgress: (loaded: number) => void,
): Promise<{ driveFileId?: string; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/stream");
    xhr.setRequestHeader("X-Drive-Upload-Url", uploadUrl);
    xhr.setRequestHeader("X-File-Size", String(chunk.size));
    // Luôn gửi Content-Range để Drive biết vị trí chunk
    xhr.setRequestHeader("X-Content-Range", `bytes ${start}-${end}/${total}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText) as { driveFileId?: string };
          resolve({ driveFileId: data.driveFileId, ok: true });
        } catch {
          reject(new Error("Không thể parse phản hồi từ Drive"));
        }
      } else if (xhr.status === 308) {
        // Intermediate chunk OK — Drive chờ chunk tiếp theo
        resolve({ ok: true });
      } else {
        try {
          const errData = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(errData.error ?? `Upload thất bại (${xhr.status})`));
        } catch {
          reject(new Error(`Upload thất bại (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Lỗi kết nối khi upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload bị huỷ")));
    xhr.send(chunk);
  });
}

export function FileUpload({ topicId, fileType, onSuccess, accept, label, maxSizeMB }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt";

  function handleFile(f: File) {
    if (maxSizeMB && f.size > maxSizeMB * 1024 * 1024) {
      setError(`File vượt quá ${maxSizeMB}MB. Vui lòng chọn file nhỏ hơn.`);
      return;
    }
    setFile(f);
    setSuccess(false);
    setError("");
    setProgress(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress(0);

    try {
      // ── Bước 1: Lấy uploadUrl từ server ──────────────────────────────
      const initiateRes = await fetch("/api/upload/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          fileType,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });

      const initiateData = await initiateRes.json();
      if (!initiateRes.ok) {
        setError(initiateData.error ?? "Không thể khởi tạo upload");
        return;
      }

      const { uploadUrl } = initiateData as { uploadUrl: string; storedName: string };

      // ── Bước 2: Upload từng chunk lên Drive ───────────────────────────
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let driveFileId = "";
      let bytesUploadedSoFar = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size) - 1; // byte index (inclusive)
        const chunk = file.slice(start, end + 1);
        const isLastChunk = end + 1 === file.size;

        const result = await uploadChunk(
          uploadUrl,
          chunk,
          start,
          end,
          file.size,
          isLastChunk,
          (loaded) => {
            const overall = ((bytesUploadedSoFar + loaded) / file.size) * 100;
            setProgress(Math.min(Math.round(overall), 99)); // giữ 99% đến khi finalize xong
          },
        );

        bytesUploadedSoFar += chunk.size;
        if (isLastChunk && result.driveFileId) {
          driveFileId = result.driveFileId;
        }
      }

      if (!driveFileId) {
        setError("Drive không trả về file ID sau khi upload");
        return;
      }

      setProgress(100);

      // ── Bước 3: Finalize — lưu DB + xử lý nghiệp vụ ─────────────────
      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          fileType,
          driveFileId,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        setError(finalizeData.error ?? "Lỗi khi hoàn tất upload");
        return;
      }

      setSuccess(true);
      onSuccess?.(finalizeData.fileUrl, finalizeData.originalName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối, vui lòng thử lại");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setSuccess(false);
    setError("");
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const isUploadingToDrive = uploading && progress !== null && progress < 100;
  const isProcessing = uploading && progress === 100;

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-sm font-medium text-slate-700">
          {label} <span className="text-slate-400 font-normal">({FILE_TYPE_LABELS[fileType]})</span>
        </p>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl transition-all",
          file ? "border-slate-200 bg-slate-50 cursor-default" : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer",
          dragging && "border-blue-400 bg-blue-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? DEFAULT_ACCEPT}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {!file ? (
          <div className="flex flex-col items-center justify-center py-4 px-4 text-center">
            <Upload className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Kéo thả file hoặc click để chọn</p>
            <p className="text-xs text-slate-400 mt-1">
              {maxSizeMB ? `Tối đa ${maxSizeMB}MB` : "Không giới hạn dung lượng"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <File className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 truncate max-w-50">{file.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Thanh tiến trình */}
      {isUploadingToDrive && progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Đang tải lên Google Drive...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="text-xs font-medium">Đang xử lý, vui lòng chờ...</span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">Upload thành công!</span>
        </div>
      )}

      {file && !success && !uploading && (
        <button
          type="button"
          onClick={handleUpload}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload file
        </button>
      )}

      {file && uploading && (
        <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-400 text-white text-sm font-medium rounded-lg cursor-not-allowed">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isProcessing ? "Đang xử lý..." : "Đang upload..."}
        </div>
      )}
    </div>
  );
}
