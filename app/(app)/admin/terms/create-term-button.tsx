"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input, Select } from "@/components/ui/index";
import { toast } from "@/components/ui/index";
import { createTermAction, setActiveTermAction, updateTermDeadlineAction } from "@/app/actions/user.actions";
import { PlusCircle, Pencil } from "lucide-react";

export function CreateTermButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    academic_year: "2024-2025",
    semester: "1",
    batch: "1",
    is_active: false,
    bctt_deadline: "",
    kltn_deadline: "",
  });

  async function handleCreate() {
    if (!form.academic_year || !form.semester || !form.batch) {
      toast("Vui lòng điền đầy đủ thông tin", "error"); return;
    }
    setLoading(true);
    const result = await createTermAction(form);
    setLoading(false);
    if (result.success) {
      toast("Tạo học kỳ thành công!", "success");
      setOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <Button leftIcon={PlusCircle} onClick={() => setOpen(true)}>Tạo học kỳ mới</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Tạo học kỳ / Đợt mới" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} loading={loading}>Tạo</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Năm học *"
            value={form.academic_year}
            onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
            placeholder="2024-2025"
          />
          <Select
            label="Học kỳ *"
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            options={[
              { value: "1", label: "Học kỳ 1" },
              { value: "2", label: "Học kỳ 2" },
              { value: "3", label: "Học kỳ 3 (Hè)" },
            ]}
          />
          <Select
            label="Đợt *"
            value={form.batch}
            onChange={(e) => setForm({ ...form, batch: e.target.value })}
            options={[
              { value: "1", label: "Đợt 1" },
              { value: "2", label: "Đợt 2" },
              { value: "3", label: "Đợt 3" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Hạn nộp BCTT"
              type="date"
              value={form.bctt_deadline}
              onChange={(e) => setForm({ ...form, bctt_deadline: e.target.value })}
            />
            <Input
              label="Hạn nộp KLTN"
              type="date"
              value={form.kltn_deadline}
              onChange={(e) => setForm({ ...form, kltn_deadline: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-700">Đặt làm học kỳ đang hoạt động</span>
          </label>
        </div>
      </Modal>
    </>
  );
}

export function SetActiveButton({ termId }: { termId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSetActive() {
    setLoading(true);
    const result = await setActiveTermAction(termId);
    setLoading(false);
    if (result.success) {
      toast("Đã đặt học kỳ đang hoạt động", "success");
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <button
      onClick={handleSetActive}
      disabled={loading}
      className="text-xs text-blue-600 hover:underline font-medium disabled:text-slate-400"
    >
      {loading ? "..." : "Đặt làm hiện tại"}
    </button>
  );
}

export function EditDeadlineButton({
  termId,
  bcttDeadline,
  kltnDeadline,
}: {
  termId: string;
  bcttDeadline?: string;
  kltnDeadline?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bctt, setBctt] = useState(bcttDeadline ?? "");
  const [kltn, setKltn] = useState(kltnDeadline ?? "");

  async function handleSave() {
    setLoading(true);
    const result = await updateTermDeadlineAction(termId, bctt, kltn);
    setLoading(false);
    if (result.success) {
      toast("Đã cập nhật hạn nộp", "success");
      setOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium"
      >
        <Pencil className="w-3 h-3" />
        Sửa hạn nộp
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cập nhật hạn nộp" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} loading={loading}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Hạn nộp BCTT"
            type="date"
            value={bctt}
            onChange={(e) => setBctt(e.target.value)}
          />
          <Input
            label="Hạn nộp KLTN"
            type="date"
            value={kltn}
            onChange={(e) => setKltn(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
