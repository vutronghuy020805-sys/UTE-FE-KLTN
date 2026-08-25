"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { createDriveFolder, shareFolderPublic, getFolderUrl } from "@/lib/drive-client";
import { db } from "@/lib/sheets/client";
import { ok, err, type ActionResult } from "@/lib/utils";

export interface CreatedFolderResult {
  key: string;
  label: string;
  url: string;
}

export async function createDepartmentFoldersAction(
  departmentCode: string,
  departmentName: string,
): Promise<ActionResult<CreatedFolderResult[]>> {
  try {
    await requireAdmin();

    const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!parentId) {
      return err("Thiếu GOOGLE_DRIVE_FOLDER_ID trong .env.local");
    }

    // ── BƯỚC 1: Tạo folder trên Drive ───────────────────────────
    let deptFolderId: string;
    try {
      deptFolderId = await createDriveFolder(departmentName, parentId);
      await shareFolderPublic(deptFolderId);
    } catch (e) {
      return err(
        `Không tạo được folder ngành trên Drive. ` +
        `Kiểm tra service account có quyền Editor vào folder gốc chưa. ` +
        `Chi tiết: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    const results: CreatedFolderResult[] = [];

    // BCTT
    const bcttId = await createDriveFolder("BCTT", deptFolderId);
    await shareFolderPublic(bcttId);

    for (const dot of ["Đợt 1", "Đợt 2"]) {
      const dotKey = dot === "Đợt 1" ? "DOT1" : "DOT2";
      const fId = await createDriveFolder(dot, bcttId);
      await shareFolderPublic(fId);
      results.push({
        key: `${departmentCode}_BCTT_${dotKey}`,
        label: `${departmentName} – BCTT ${dot}`,
        url: getFolderUrl(fId),
      });
    }

    // KLTN
    const kltnId = await createDriveFolder("KLTN", deptFolderId);
    await shareFolderPublic(kltnId);

    for (const dot of ["Đợt 1", "Đợt 2"]) {
      const dotKey = dot === "Đợt 1" ? "DOT1" : "DOT2";
      const fId = await createDriveFolder(dot, kltnId);
      await shareFolderPublic(fId);
      results.push({
        key: `${departmentCode}_KLTN_${dotKey}`,
        label: `${departmentName} – KLTN ${dot}`,
        url: getFolderUrl(fId),
      });
    }

    // ── BƯỚC 2: Lưu URL vào sheet (không fail cả action nếu sheet lỗi) ──
    let sheetError = "";
    try {
      for (const r of results) {
        await db.driveFolders.save(r.key, r.url, r.label);
      }
    } catch (e) {
      sheetError = ` (Lưu sheet thất bại: ${e instanceof Error ? e.message : "sheet drive_folders chưa tồn tại?"})`;
    }

    revalidatePath("/admin/drive");
    return ok(
      results,
      `Đã tạo ${results.length} folder cho ngành ${departmentName}.${sheetError}`
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Lỗi không xác định");
  }
}
