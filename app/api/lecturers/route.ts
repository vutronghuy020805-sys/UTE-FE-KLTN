import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const [lecturerList, deanList, activeTerm, allQuotas, studentRecord] = await Promise.all([
      db.users.filter({ system_role: "LECTURER" }),
      db.users.filter({ system_role: "DEAN" }),
      db.terms.getActive(),
      db.quotas.getAll(),
      db.users.findById(session.user.id),
    ]);

    const lecturers = [...lecturerList, ...deanList];
    const trainingSystem = studentRecord?.training_system?.trim() ?? "";

    const activeOnly = lecturers.filter(
      (l) => l.is_active?.toString().toUpperCase() === "TRUE",
    );

    // Lọc quota theo đợt đang hoạt động
    const termQuotas = activeTerm
      ? allQuotas.filter(
          (q) =>
            q.academic_year === activeTerm.academic_year &&
            q.semester === activeTerm.semester,
        )
      : allQuotas; // fallback: dùng tất cả nếu không có term

    function findQuota(lecturerId: string) {
      const matching = termQuotas.filter((q) => q.lecturer_id === lecturerId);
      if (matching.length === 0) return null;
      if (!trainingSystem) {
        // Ưu tiên quota ALL, fallback bất kỳ
        return (
          matching.find((q) => !q.training_system || q.training_system === "" || q.training_system === "ALL") ??
          matching[0]
        );
      }
      // Khớp đúng training_system, fallback ALL, fallback bất kỳ
      return (
        matching.find((q) => q.training_system === trainingSystem) ??
        matching.find((q) => !q.training_system || q.training_system === "" || q.training_system === "ALL") ??
        matching[0]
      );
    }

    const withQuota = activeOnly.map((l) => {
      const quota = findQuota(l.email) ?? findQuota(l.id);
      const quotaNum = quota ? Number(quota.quota) : null;
      const countNum = quota ? Number(quota.current_count) : 0;
      // Coi là mở nếu: is_approved = "true", HOẶC is_approved chưa đặt (dữ liệu cũ) mà quota > 0
      // Đóng chỉ khi: is_approved = "false" tường minh, hoặc không có quota
      const approvedFlag = quota?.is_approved?.toString().toLowerCase();
      const isApproved =
        !quota || quotaNum === null || quotaNum <= 0
          ? false
          : approvedFlag === "false"
          ? false
          : true; // "true" hoặc chưa set đều coi là mở

      return {
        id: l.id,
        full_name: l.full_name,
        email: l.email,
        department: l.department,
        quota: isApproved ? quotaNum : null,
        current_count: isApproved ? countNum : 0,
        is_approved: isApproved,
        is_full: isApproved && quotaNum !== null && countNum >= quotaNum,
      };
    });

    withQuota.sort((a, b) => {
      if (a.is_full && !b.is_full) return 1;
      if (!a.is_full && b.is_full) return -1;
      if (a.is_approved && !b.is_approved) return -1;
      if (!a.is_approved && b.is_approved) return 1;
      return a.full_name.localeCompare(b.full_name, "vi");
    });

    return NextResponse.json({ lecturers: withQuota });
  } catch (error) {
    console.error("Error fetching lecturers:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
