"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/sheets/client";
import { requireAdmin, requireDean, requireAuth } from "@/lib/permissions";
import { generateId, nowISO, ok, err, type ActionResult } from "@/lib/utils";
import type { SystemRole } from "@/types";
import { uploadFileToDrive, deleteFileFromDrive } from "@/lib/drive-client";

// ============================================================
// QUẢN LÝ TÀI KHOẢN (Admin)
// Lưu ý: Hệ thống dùng Google OAuth nên không có password.
// Admin chỉ cần tạo record với email Google của user.
// ============================================================

export async function createUserAction(data: {
  email: string;
  full_name: string;
  system_role: SystemRole;
  student_code?: string;
  phone?: string;
  department?: string;
  major?: string;
}): Promise<ActionResult<{ userId: string }>> {
  try {
    const admin = await requireAdmin();

    const existing = await db.users.findByEmail(data.email);
    if (existing) return err("Email này đã được đăng ký trong hệ thống");

    const userId = generateId();
    const now = nowISO();

    await db.users.create({
      id: userId,
      email: data.email,
      password_hash: "GOOGLE_AUTH", // Không dùng password — đăng nhập qua Google
      full_name: data.full_name,
      system_role: data.system_role,
      student_code: data.student_code ?? "",
      phone: data.phone ?? "",
      department: data.department ?? "",
      major: data.major ?? "",
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    await db.auditLogs.create({
      id: generateId(), actor_id: admin.id, action: "CREATE_USER",
      target_table: "users", target_id: userId,
      detail: JSON.stringify({ email: data.email, role: data.system_role }),
      created_at: nowISO(),
    });

    revalidatePath("/admin/users");
    return ok({ userId }, "Tạo tài khoản thành công. User đăng nhập bằng Google với email này.");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function updateUserAction(
  userId: string,
  data: {
    full_name?: string;
    phone?: string;
    department?: string;
    major?: string;
    system_role?: SystemRole;
  }
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await db.users.update(userId, { ...data, updated_at: nowISO() });
    await db.auditLogs.create({
      id: generateId(), actor_id: admin.id, action: "UPDATE_USER",
      target_table: "users", target_id: userId,
      detail: JSON.stringify(data), created_at: nowISO(),
    });
    revalidatePath("/admin/users");
    return ok(undefined, "Cập nhật tài khoản thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function toggleUserActiveAction(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    const user = await db.users.findById(userId);
    if (!user) return err("Không tìm thấy tài khoản");
    if (userId === admin.id) return err("Không thể vô hiệu hóa tài khoản của chính mình");

    const newActive = user.is_active !== "true";
    await db.users.update(userId, { is_active: newActive, updated_at: nowISO() });
    await db.auditLogs.create({
      id: generateId(), actor_id: admin.id,
      action: newActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      target_table: "users", target_id: userId, detail: "", created_at: nowISO(),
    });

    revalidatePath("/admin/users");
    return ok(undefined, newActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// QUẢN LÝ QUOTA (Trưởng khoa + Admin)
// ============================================================

export async function updateQuotaAction(
  lecturerId: string,
  quota: number,
  academicYear: string,
  semester: string,
  batch: string,
  trainingSystem?: string,
  major?: string,
): Promise<ActionResult> {
  try {
    const user = await requireDean();

    const existing = await db.quotas.findByLecturer(lecturerId, academicYear, semester, trainingSystem);
    const isExactMatch = existing && (
      (!trainingSystem && (!existing.training_system || existing.training_system === "" || existing.training_system === "ALL")) ||
      (trainingSystem && existing.training_system === trainingSystem)
    );

    const isOpen = quota > 0 ? "true" : "false";

    if (isExactMatch) {
      await db.quotas.update(existing.id, { quota, is_approved: isOpen, updated_at: nowISO() });
    } else {
      await db.quotas.create({
        id: generateId(),
        lecturer_id: lecturerId,
        quota,
        current_count: 0,
        academic_year: academicYear,
        semester,
        batch,
        training_system: trainingSystem ?? "ALL",
        major: major ?? "",
        is_approved: isOpen,
        created_at: nowISO(),
        updated_at: nowISO(),
      });
    }

    await db.auditLogs.create({
      id: generateId(), actor_id: user.id, action: "UPDATE_QUOTA",
      target_table: "lecturer_quotas", target_id: lecturerId,
      detail: JSON.stringify({ quota, trainingSystem }), created_at: nowISO(),
    });
    revalidatePath("/dean/quotas");
    return ok(undefined, "Cập nhật hạn mức thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function approveQuotaAction(
  quotaId: string,
  approve: boolean,
): Promise<ActionResult> {
  try {
    await requireDean();
    await db.quotas.update(quotaId, { is_approved: approve ? "true" : "false", updated_at: nowISO() });
    revalidatePath("/dean/quotas");
    return ok(undefined, approve ? "Đã mở slot đăng ký" : "Đã đóng slot đăng ký");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// QUẢN LÝ HỌC KỲ (Admin)
// ============================================================

export async function updateTermDeadlineAction(
  termId: string,
  bctt_deadline: string,
  kltn_deadline: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.terms.update(termId, { bctt_deadline, kltn_deadline, updated_at: nowISO() });
    revalidatePath("/admin/terms");
    return ok(undefined, "Đã cập nhật hạn nộp");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function createTermAction(data: {
  academic_year: string;
  semester: string;
  batch: string;
  is_active: boolean;
  bctt_deadline?: string;
  kltn_deadline?: string;
}): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const now = nowISO();

    if (data.is_active) {
      const allTerms = await db.terms.getAll();
      for (const term of allTerms) {
        if (term.is_active === "true") {
          await db.terms.update(term.id, { is_active: false, updated_at: now });
        }
      }
    }

    await db.terms.create({
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
    });

    await db.auditLogs.create({
      id: generateId(), actor_id: admin.id, action: "CREATE_TERM",
      target_table: "academic_terms", target_id: "new",
      detail: JSON.stringify(data), created_at: nowISO(),
    });
    revalidatePath("/admin/terms");
    return ok(undefined, "Tạo học kỳ thành công");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function setActiveTermAction(termId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const now = nowISO();

    const allTerms = await db.terms.getAll();
    for (const term of allTerms) {
      await db.terms.update(term.id, {
        is_active: term.id === termId,
        updated_at: now,
      });
    }

    await db.auditLogs.create({
      id: generateId(), actor_id: admin.id, action: "SET_ACTIVE_TERM",
      target_table: "academic_terms", target_id: termId,
      detail: "", created_at: nowISO(),
    });
    revalidatePath("/admin/terms");
    return ok(undefined, "Đã đặt học kỳ đang hoạt động");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

// ============================================================
// UPLOAD CHỮ KÝ (lưu Drive, link vào user profile)
// ============================================================

export async function uploadSignatureAction(
  formData: FormData,
): Promise<ActionResult<{ fileId: string; fileUrl: string }>> {
  try {
    const user = await requireAuth();
    const file = formData.get("file") as File | null;
    if (!file) return err("Không có file");

    // Chỉ cho phép ảnh, tối đa 2MB
    if (!file.type.startsWith("image/")) return err("File phải là ảnh (PNG, JPG)");
    if (file.size > 2 * 1024 * 1024) return err("Ảnh tối đa 2MB");

    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) return err("Chưa cấu hình GOOGLE_DRIVE_ROOT_FOLDER_ID");

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const fileName = `chu_ky_${user.id}_${Date.now()}.${ext}`;

    // Xóa chữ ký cũ (nếu có) để không rác Drive
    const current = await db.users.findById(user.id);
    if (current?.signature_file_id) {
      try { await deleteFileFromDrive(current.signature_file_id); } catch { /* ignore */ }
    }

    const { fileId, fileUrl } = await uploadFileToDrive(buffer, fileName, file.type, rootFolderId);

    await db.users.update(user.id, {
      signature_file_id: fileId,
      signature_url: fileUrl,
      updated_at: nowISO(),
    });

    revalidatePath("/supervisor/info");
    return ok({ fileId, fileUrl }, "Đã cập nhật chữ ký");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}

export async function deleteSignatureAction(): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const current = await db.users.findById(user.id);
    if (current?.signature_file_id) {
      try { await deleteFileFromDrive(current.signature_file_id); } catch { /* ignore */ }
    }
    await db.users.update(user.id, {
      signature_file_id: "",
      signature_url: "",
      updated_at: nowISO(),
    });
    revalidatePath("/supervisor/info");
    return ok(undefined, "Đã xóa chữ ký");
  } catch (e) {
    return err(e instanceof Error ? e.message : "Đã xảy ra lỗi");
  }
}
