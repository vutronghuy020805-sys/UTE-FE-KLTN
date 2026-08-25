"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Textarea } from "@/components/ui/index";
import { toast, ToastContainer } from "@/components/ui/index";
import { createTopicByDeanAction } from "@/app/actions/topic.actions";
import { ArrowLeft } from "lucide-react";

interface UserOption { id: string; full_name: string; email: string; student_code?: string }

export default function DeanCreateTopicPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<UserOption[]>([]);
  const [lecturers, setLecturers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({
    student_id: "",
    supervisor_id: "",
    title: "",
    field: "",
    topic_type: "KLTN" as "KLTN" | "BCTT",
    summary: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/users?role=STUDENT")
      .then((r) => r.json())
      .then((d) => setStudents(d.users ?? []))
      .catch(() => {});
    fetch("/api/users?role=LECTURER")
      .then((r) => r.json())
      .then((d) => setLecturers(d.users ?? []))
      .catch(() => {});
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.student_id) errs.student_id = "Vui lòng chọn sinh viên";
    if (!form.supervisor_id) errs.supervisor_id = "Vui lòng chọn GVHD";
    if (!form.title.trim()) errs.title = "Vui lòng nhập tên đề tài";
    if (!form.field.trim()) errs.field = "Vui lòng chọn lĩnh vực";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    const result = await createTopicByDeanAction(form);
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Tạo đề tài thành công!", "success");
      setTimeout(() => router.push("/dean/topics"), 1200);
    } else {
      toast(result.error, "error");
    }
  }

  const fieldOptions = [
    { value: "Công nghệ phần mềm", label: "Công nghệ phần mềm" },
    { value: "Trí tuệ nhân tạo", label: "Trí tuệ nhân tạo" },
    { value: "Hệ thống thông tin", label: "Hệ thống thông tin" },
    { value: "An toàn thông tin", label: "An toàn thông tin" },
    { value: "Mạng máy tính", label: "Mạng máy tính" },
    { value: "Khoa học dữ liệu", label: "Khoa học dữ liệu" },
    { value: "Khác", label: "Khác" },
  ];

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <ToastContainer />
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tạo đề tài mới</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Trưởng bộ môn tạo và phân công đề tài cho sinh viên
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card title="Phân công">
            <div className="space-y-3">
              <Select
                label="Sinh viên *"
                value={form.student_id}
                onChange={f("student_id")}
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.full_name}${s.student_code ? ` (${s.student_code})` : ""} — ${s.email}`,
                }))}
                placeholder="-- Chọn sinh viên --"
                error={errors.student_id}
              />
              <Select
                label="Giảng viên hướng dẫn *"
                value={form.supervisor_id}
                onChange={f("supervisor_id")}
                options={lecturers.map((l) => ({
                  value: l.id,
                  label: `${l.full_name} — ${l.email}`,
                }))}
                placeholder="-- Chọn GVHD --"
                error={errors.supervisor_id}
              />
            </div>
          </Card>

          <Card title="Thông tin đề tài">
            <div className="space-y-3">
              <Select
                label="Loại đề tài *"
                value={form.topic_type}
                onChange={f("topic_type")}
                options={[
                  { value: "KLTN", label: "Khóa luận tốt nghiệp (KLTN)" },
                  { value: "BCTT", label: "Báo cáo thực tập (BCTT)" },
                ]}
              />
              <Input
                label="Tên đề tài *"
                value={form.title}
                onChange={f("title")}
                placeholder="Ví dụ: Xây dựng hệ thống quản lý sinh viên..."
                error={errors.title}
                hint={`${form.title.length}/200 ký tự`}
              />
              <Select
                label="Lĩnh vực *"
                value={form.field}
                onChange={f("field")}
                options={fieldOptions}
                placeholder="-- Chọn lĩnh vực --"
                error={errors.field}
              />
              <Textarea
                label="Mô tả sơ lược"
                value={form.summary}
                onChange={f("summary")}
                rows={3}
                placeholder="Mô tả ngắn gọn mục tiêu và nội dung đề tài..."
              />
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Xác nhận tạo đề tài
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
