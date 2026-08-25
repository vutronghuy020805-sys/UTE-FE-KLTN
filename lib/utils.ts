import { v4 as uuidv4 } from "uuid";

// ============================================================
// ID GENERATOR
// ============================================================
export function generateId(): string {
  return uuidv4();
}

// ============================================================
// DATE/TIME
// ============================================================
export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// FILE SIZE FORMAT
// ============================================================
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// CLASS NAME HELPER
// ============================================================
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ============================================================
// SERVER ACTION RESPONSE
// ============================================================
export type ActionResult<T = void> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string };

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function err(error: string): ActionResult<never> {
  return { success: false, error };
}
