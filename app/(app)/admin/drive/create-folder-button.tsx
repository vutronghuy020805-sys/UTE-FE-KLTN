"use client";

import { useState } from "react";
import { FolderPlus, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { createDepartmentFoldersAction } from "@/app/actions/drive.actions";
import { toast } from "@/components/ui/index";

interface Props {
  departmentCode: string;
  departmentName: string;
  alreadyCreated: boolean;
}

export function CreateFolderButton({ departmentCode, departmentName, alreadyCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyCreated);

  async function handleCreate() {
    if (!confirm(`Tạo folder Drive cho ngành "${departmentName}"?\n\nCác folder sẽ được tạo trong thư mục gốc và share "Anyone with link can edit".`)) return;

    setLoading(true);
    const result = await createDepartmentFoldersAction(departmentCode, departmentName);
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Đã tạo folder!", "success");
      setDone(true);
    } else {
      toast(result.error, "error");
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
        <CheckCircle2 className="w-4 h-4" /> Đã tạo
      </span>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors font-medium"
    >
      {loading ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>
      ) : (
        <><FolderPlus className="w-3.5 h-3.5" /> Tạo folder</>
      )}
    </button>
  );
}
