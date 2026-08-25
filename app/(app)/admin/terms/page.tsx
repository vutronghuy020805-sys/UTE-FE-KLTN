export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { CreateTermButton } from "./create-term-button";
import { TermsFilterTable } from "./terms-filter-table";
import { TriggerReminderButton } from "./trigger-reminder-button";

export default async function AdminTermsPage() {
  const terms = await db.terms.getAll();
  terms.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý học kỳ / Đợt</h1>
          <p className="text-sm text-slate-500 mt-1">Học kỳ đang hoạt động xác định kỳ đăng ký mặc định</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TriggerReminderButton />
          <CreateTermButton />
        </div>
      </div>

      <TermsFilterTable terms={terms.map((t) => ({
        id: t.id ?? "",
        academic_year: t.academic_year ?? "",
        semester: t.semester ?? "",
        batch: t.batch ?? "",
        bctt_deadline: t.bctt_deadline ?? "",
        kltn_deadline: t.kltn_deadline ?? "",
        is_active: t.is_active ?? "",
      }))} />
    </div>
  );
}
