"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { setActiveTermAction } from "@/app/actions/user.actions";

export function SetActiveButton({ termId }: { termId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSetActive() {
    setLoading(true);
    const result = await setActiveTermAction(termId);
    setLoading(false);
    if (result.success) {
      toast("Đã đặt học kỳ đang hoạt động", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <button
      onClick={handleSetActive}
      disabled={loading}
      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {loading ? "..." : "Đặt làm hiện tại"}
    </button>
  );
}
