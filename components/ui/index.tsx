"use client";
// ============================================================
// CLIENT COMPONENTS - Chỉ dùng trong Client Component
// Gồm: Modal, Button, Toast, ConfirmDialog (cần useState/useEffect)
// ============================================================

import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";

// Re-export tất cả server components để import 1 chỗ vẫn được
export {
  Badge,
  Card,
  StatCard,
  Table,
  Thead,
  Tbody,
  Th,
  Td,
  Tr,
  EmptyState,
  Input,
  Select,
  Textarea,
} from "./server-ui";

// ─── BUTTON ──────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ElementType;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  leftIcon: LeftIcon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}

// ─── LOADING ─────────────────────────────────────────────────
export function LoadingSpinner({ text = "Đang tải..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      <span className="text-sm text-slate-500">{text}</span>
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-white rounded-2xl shadow-2xl w-full",
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOAST ───────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";
interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

let toastFn: ((msg: string, type: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = "success") {
  toastFn?.(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    toastFn = (message, type) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { message, type, id }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    };
    return () => {
      toastFn = null;
    };
  }, []);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 animate-in slide-in-from-bottom-5"
        >
          {icons[t.type]}
          <p className="text-sm text-slate-700">{t.message}</p>
          <button
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            className="ml-auto shrink-0"
          >
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── CONFIRM DIALOG ──────────────────────────────────────────
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  variant = "primary",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-slate-600">{description}</p>}
    </Modal>
  );
}
