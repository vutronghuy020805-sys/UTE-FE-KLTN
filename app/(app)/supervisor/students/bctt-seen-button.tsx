"use client";

import { useState, useTransition } from "react";
import { Eye, CheckCircle2, Loader2 } from "lucide-react";
import { markAllBcttSeenAction } from "@/app/actions/topic.actions";

export function BcttSeenAllButton({
  unseenTopicIds,
  initialAllSeen,
}: {
  unseenTopicIds: string[];
  initialAllSeen: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [allSeen, setAllSeen] = useState(initialAllSeen);

  function handleSeen() {
    startTransition(async () => {
      const res = await markAllBcttSeenAction(unseenTopicIds);
      if (res.success) setAllSeen(true);
    });
  }

  if (allSeen || unseenTopicIds.length === 0) {
    return (
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
        <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
          <CheckCircle2 className="w-4 h-4" /> Đã xem
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
      <button
        onClick={handleSeen}
        disabled={isPending}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        Đã xem
      </button>
    </div>
  );
}
