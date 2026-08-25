"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/index";
import { approveQuotaAction } from "@/app/actions/user.actions";

export function ApproveQuotaButton({
  quotaId,
  isApproved,
}: {
  quotaId: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(isApproved);

  async function handle() {
    setLoading(true);
    const next = !approved;
    const result = await approveQuotaAction(quotaId, next);
    setLoading(false);
    if (result.success) {
      setApproved(next);
      toast(result.message ?? "Đã cập nhật", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60 ${
        approved
          ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700 hover:border-red-300 border border-green-300"
          : "bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700 hover:border-green-300 border border-red-300"
      }`}
    >
      {loading ? "..." : approved ? "✓ Đã mở" : "✕ Đã đóng"}
    </button>
  );
}
