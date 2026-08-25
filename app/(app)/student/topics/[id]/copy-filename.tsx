"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyFilename({ filename }: { filename: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(filename);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <p className="text-sm text-slate-600">
      Bạn copy :{" "}
      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1 font-mono font-semibold px-1.5 py-0.5 rounded transition-colors ${
          copied
            ? "bg-green-100 text-green-700"
            : "bg-blue-50 text-blue-700 hover:bg-blue-100"
        }`}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {filename}
      </button>
      {" "}đặt cho tên file bạn chuẩn bị nộp nhé.
    </p>
  );
}
