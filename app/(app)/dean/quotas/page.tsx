export const dynamic = 'force-dynamic';

import { db } from "@/lib/sheets/client";
import { Card } from "@/components/ui/index";
import { QuotaTableClient } from "./quota-table-client";
import { AlertCircle } from "lucide-react";
import { getDeanScopeMajor } from "@/lib/permissions";

export default async function DeanQuotasPage() {
  const [allUsers, allQuotas, activeTerm, scopeMajor] = await Promise.all([
    db.users.getAll(),
    db.quotas.getAll(),
    db.terms.getActive(),
    getDeanScopeMajor(),
  ]);

  const termQuotas = activeTerm
    ? allQuotas.filter(
        (q) =>
          q.academic_year === activeTerm.academic_year &&
          q.semester === activeTerm.semester,
      )
    : allQuotas;

  const allLecturers = allUsers
    .filter((u) => ["LECTURER", "DEAN"].includes(u.system_role) && u.is_active?.toString().toUpperCase() === "TRUE")
    // Lọc theo ngành của TBM (ADMIN scopeMajor=null → thấy tất cả)
    .filter((u) => !scopeMajor || (u.major || u.department || "").trim() === scopeMajor);

  const rows = allLecturers.flatMap((l) => {
    const matchId = (q: (typeof allQuotas)[0]) =>
      q.lecturer_id === l.email || q.lecturer_id === l.id?.toString();

    const termLQ = termQuotas.filter(matchId);
    const allLQ = allQuotas.filter(matchId);

    const makeRow = (trainingSystem: "REGULAR" | "CLC") => {
      const isRegular = trainingSystem === "REGULAR";
      // Tìm row đúng hệ trong kỳ hiện tại; ĐT cũng chấp nhận row cũ không có training_system
      let termRow = termLQ.find((q) => q.training_system === trainingSystem) ?? null;
      if (!termRow && isRegular) {
        termRow = termLQ.find((q) => !q.training_system || q.training_system === "ALL" || q.training_system === "") ?? null;
      }
      let sheetRow = allLQ.find((q) => q.training_system === trainingSystem) ?? null;
      if (!sheetRow && isRegular) {
        sheetRow = allLQ.find((q) => !q.training_system || q.training_system === "ALL" || q.training_system === "") ?? null;
      }
      const effectiveRow = termRow ?? sheetRow;
      const quota = effectiveRow ? Number(effectiveRow.quota) : 0;
      const approvedFlag = effectiveRow?.is_approved?.toString().toLowerCase();
      const is_approved = !effectiveRow || quota <= 0 ? false : approvedFlag === "false" ? false : true;
      return {
        rowKey: `${l.email}_${trainingSystem}`,
        lecturerId: l.email,
        trainingSystem,
        trainingLabel: isRegular ? "ĐT" : "CLC",
        lecturerName: l.full_name,
        department: l.department ?? "",
        major: effectiveRow?.major ?? l.major ?? "",
        email: l.email,
        quotaId: effectiveRow?.id ?? null,
        quota,
        current_count: effectiveRow ? Number(effectiveRow.current_count) : 0,
        is_approved,
        academicYear: activeTerm?.academic_year ?? "",
        semester: activeTerm?.semester ?? "",
        batch: activeTerm?.batch ?? "",
        syncedWithTerm: termRow !== null,
      };
    };

    return [makeRow("REGULAR"), makeRow("CLC")];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hạn mức giảng viên</h1>
        <p className="text-sm text-slate-500 mt-1">
          Thiết lập số lượng sinh viên tối đa mỗi giảng viên có thể hướng dẫn
        </p>
      </div>

      {activeTerm ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-800">
              {activeTerm.academic_year} · HK{activeTerm.semester} · Đợt {activeTerm.batch}
            </h2>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full font-medium">
              Đang hoạt động
            </span>
          </div>
          <Card>
            <QuotaTableClient rows={rows} />
          </Card>
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Chưa có học kỳ đang hoạt động. Tạo học kỳ trong phần Quản trị.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
