// ============================================================
// SERVER COMPONENTS - Không có "use client"
// Dùng cho StatCard, Card, Badge, Table, EmptyState
// Có thể import từ cả Server và Client Component
// ============================================================

import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

// ─── BADGE ───────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "danger" | "warning" | "info";
}

export function Badge({
  children,
  className,
  variant = "default",
}: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-green-100 text-green-700",
    danger: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── CARD ────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function Card({
  children,
  className,
  title,
  description,
  action,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-sm",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────
// icon nhận ReactNode (đã render sẵn) thay vì ElementType
export function StatCard({
  label,
  value,
  icon,
  trend,
  color = "blue",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: "blue" | "green" | "amber" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                trend.positive ? "text-green-600" : "text-red-600",
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              colors[color],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TABLE ───────────────────────────────────────────────────
export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-clip rounded-xl border border-slate-200",
        className,
      )}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">{children}</thead>
  );
}
export function Tbody({ children }: { children: React.ReactNode }) {
  return (
    <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
  );
}
export function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 text-slate-700 align-top", className)}>
      {children}
    </td>
  );
}
export function Tr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        "hover:bg-slate-50 transition-colors",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────
// icon nhận ReactNode thay vì ElementType
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── INPUT (dùng được cả 2 phía) ─────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full px-3 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2",
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-slate-300 focus:ring-blue-500 focus:border-transparent",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full px-3 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 bg-white",
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-slate-300 focus:ring-blue-500 focus:border-transparent",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── TEXTAREA ────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          "w-full px-3 py-2.5 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 resize-none",
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-slate-300 focus:ring-blue-500 focus:border-transparent",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
