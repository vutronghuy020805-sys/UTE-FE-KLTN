"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input, Select } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import {
  createUserAction,
  toggleUserActiveAction,
} from "@/app/actions/user.actions";
import { UserPlus, MoreHorizontal, Power } from "lucide-react";
import type { SystemRole } from "@/types";

// ─── Create User Button ───────────────────────────────────────
export function CreateUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    system_role: "STUDENT" as SystemRole,
    student_code: "",
    phone: "",
    department: "",
    major: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.includes("@")) e.email = "Email không hợp lệ";
    if (!form.full_name.trim()) e.full_name = "Vui lòng nhập họ tên";
    return e;
  }

  async function handleCreate() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    const result = await createUserAction(form);
    setLoading(false);
    if (result.success) {
      toast("Tạo tài khoản thành công!", "success");
      setOpen(false);
      setForm({ email: "", full_name: "", system_role: "STUDENT", student_code: "", phone: "", department: "", major: "" });
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  const roleOptions = [
    { value: "STUDENT",  label: "Sinh viên" },
    { value: "LECTURER", label: "Giảng viên" },
    { value: "DEAN",     label: "Trưởng bộ môn" },
    { value: "ADMIN",    label: "Quản trị viên" },
  ];

  return (
    <>
      <Button leftIcon={UserPlus} onClick={() => setOpen(true)}>
        Thêm tài khoản
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Thêm tài khoản mới" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} loading={loading}>Tạo tài khoản</Button>
          </>
        }
      >
        {/* Note về Google Auth */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-xs text-blue-700">
          <p className="font-semibold mb-1">📌 Lưu ý quan trọng</p>
          <p>Hệ thống dùng <strong>Google OAuth</strong>. Hãy nhập <strong>Gmail</strong> của người dùng. Họ sẽ đăng nhập bằng nút "Tiếp tục với Google" mà không cần mật khẩu.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Họ và tên *" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            error={errors.full_name} />
          <Input label="Gmail *" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email} placeholder="example@gmail.com" />
          <Select label="Vai trò *" value={form.system_role}
            onChange={(e) => setForm({ ...form, system_role: e.target.value as SystemRole })}
            options={roleOptions} />
          <Input label="Số điện thoại" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {form.system_role === "STUDENT" && (
            <Input label="Mã số sinh viên" value={form.student_code}
              onChange={(e) => setForm({ ...form, student_code: e.target.value })} />
          )}
          <Input label="Khoa / Bộ môn" value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })} />
          {form.system_role === "STUDENT" && (
            <Input label="Ngành học" value={form.major}
              onChange={(e) => setForm({ ...form, major: e.target.value })} />
          )}
        </div>
      </Modal>
    </>
  );
}

// ─── User Actions Menu ────────────────────────────────────────
export function UserActionsMenu({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setMenuOpen(false);
    setLoading(true);
    const result = await toggleUserActiveAction(userId);
    setLoading(false);
    if (result.success) {
      toast(result.message ?? "Đã cập nhật", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <button
              onClick={handleToggle}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-slate-50 text-left disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              {isActive ? "Vô hiệu hóa" : "Kích hoạt"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
