"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, Button, Input, Select, Textarea } from "@/components/ui/index";
import { toast, ToastContainer } from "@/components/ui/index";
import { registerTopicAction } from "@/app/actions/topic.actions";
import { AlertCircle, Info, ChevronDown, X } from "lucide-react";

interface Lecturer {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  current_count?: number;
  quota?: number | null;
  is_approved?: boolean;
  is_full?: boolean;
}

interface FieldRow {
  email: string;
  major: string;
  field: string;
}

interface TermRow {
  id?: string;
  Dot: string;
  Major: string;
  Loaidetai: string;
  StartReg: string;
  EndReg: string;
  Active: string;
  academic_year?: string;
  semester?: string;
  batch?: string;
}

export default function RegisterTopicPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studentDepartment = session?.user?.major ?? "";
  const [loading, setLoading] = useState(false);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [fieldRows, setFieldRows] = useState<FieldRow[]>([]);
  const [hasPassedBctt, setHasPassedBctt] = useState<boolean | null>(null);
  const [bcttSupervisor, setBcttSupervisor] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    field: "",
    department: "",   // dùng để lưu "ngành" (major)
    topic_type: "KLTN" as "KLTN" | "BCTT",
    topic_category: "UNG_DUNG" as "UNG_DUNG" | "NGHIEN_CUU",
    supervisor_id: "",
    company_name: "",
    summary: "",
  });
  const [openTerms, setOpenTerms] = useState<TermRow[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<TermRow | null>(null);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const supervisorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (supervisorRef.current && !supervisorRef.current.contains(e.target as Node)) {
        setSupervisorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-fill ngành từ hồ sơ sinh viên
  useEffect(() => {
    if (studentDepartment) {
      setForm((prev) => ({ ...prev, department: studentDepartment, field: "", supervisor_id: "" }));
    }
  }, [studentDepartment]);

  useEffect(() => {
    fetch("/api/lecturers")
      .then((r) => r.json())
      .then((data) => setLecturers(data.lecturers ?? []))
      .catch(() => {});

    fetch("/api/fields")
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.rows ?? []).map((r: Record<string, string>) => ({
          email: (r.email ?? r.Email ?? "").toLowerCase().trim(),
          major: r.major ?? r.Major ?? "",
          field: r.field ?? r.Field ?? "",
        })).filter((r: FieldRow) => r.email && r.major);
        setFieldRows(rows);
      })
      .catch(() => {});

    fetch("/api/my-topics")
      .then((r) => r.json())
      .then((data) => {
        const bctt = (data.topics ?? []).find(
          (t: { topic_type: string; current_status: string; supervisor_id?: string; supervisor_name?: string }) =>
            t.topic_type === "BCTT" && t.current_status === "HOAN_TAT",
        );
        setHasPassedBctt(!!bctt);
        if (bctt?.supervisor_id) {
          setBcttSupervisor({ id: bctt.supervisor_id, name: bctt.supervisor_name ?? "Giảng viên hướng dẫn BCTT" });
        }
      })
      .catch(() => setHasPassedBctt(false));
  }, []);

  // Fetch đợt mở khi ngành hoặc loại đề tài thay đổi
  useEffect(() => {
    if (!form.department) { setOpenTerms([]); setSelectedTerm(null); return; }
    setLoadingTerms(true);
    setSelectedTerm(null);
    fetch(`/api/terms?major=${encodeURIComponent(form.department)}&type=${form.topic_type}`)
      .then((r) => r.json())
      .then((data) => { setOpenTerms(data.terms ?? []); })
      .catch(() => setOpenTerms([]))
      .finally(() => setLoadingTerms(false));
  }, [form.department, form.topic_type]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Vui lòng nhập tên đề tài";
    if (form.title.length > 200) errs.title = "Tên đề tài tối đa 200 ký tự";
    if (!form.field.trim()) errs.field = "Vui lòng chọn lĩnh vực";
    if (!selectedTerm) errs.term = "Vui lòng chọn đợt đăng ký";
    if (form.topic_type === "BCTT" && !form.supervisor_id) errs.supervisor_id = "Vui lòng chọn giảng viên hướng dẫn";
    if (form.topic_type === "BCTT" && !form.company_name.trim()) {
      errs.company_name = "Vui lòng nhập tên công ty thực tập";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    const result = await registerTopicAction({
      ...form,
      academic_year: selectedTerm?.academic_year ?? "",
      semester: selectedTerm?.semester ?? "",
      batch: selectedTerm?.Dot ?? selectedTerm?.batch ?? "",
    });
    setLoading(false);

    if (result.success) {
      toast(result.message ?? "Đăng ký thành công!", "success");
      setTimeout(() => router.push("/student/status"), 1500);
    } else {
      toast(result.error, "error");
    }
  }

  const topicTypeOptions = [
    { value: "KLTN", label: "Khóa luận tốt nghiệp (KLTN)" },
    { value: "BCTT", label: "Báo cáo thực tập (BCTT)" },
  ];

  const topicCategoryOptions = [
    { value: "UNG_DUNG", label: "Đề tài ứng dụng" },
    { value: "NGHIEN_CUU", label: "Đề tài nghiên cứu" },
  ];

  // Ngành: lấy unique từ cột Major trong sheet Field
  const majorOptions = Array.from(new Set(fieldRows.map((r) => r.major).filter(Boolean))).map((m) => ({
    value: m,
    label: m,
  }));

  // Lĩnh vực: lọc theo ngành đã chọn, lấy unique Field (bao gồm cả row không có Field)
  const fieldOptions = form.department
    ? Array.from(
        new Set(
          fieldRows
            .filter((r) => r.major === form.department && r.field)
            .map((r) => r.field)
        )
      ).map((f) => ({ value: f, label: f }))
    : [];

  // Emails được gợi ý: lấy từ sheet Field theo ngành + lĩnh vực đã chọn
  const suggestedEmails = form.department
    ? new Set(
        fieldRows
          .filter((r) => {
            if (r.major !== form.department) return false;
            if (form.field && r.field && r.field !== form.field) return false;
            return true;
          })
          .map((r) => r.email)
      )
    : null;

  // Giảng viên: ưu tiên gợi ý từ sheet Field, phần còn lại xếp sau
  const suggestedLecturers = suggestedEmails
    ? lecturers.filter((l) => suggestedEmails.has(l.email.toLowerCase().trim()))
    : lecturers;

  const otherLecturers = suggestedEmails
    ? lecturers.filter((l) => !suggestedEmails.has(l.email.toLowerCase().trim()))
    : [];

  function lecturerLabel(l: Lecturer) {
    let suffix = "";
    if (!l.is_approved) suffix = " — Chưa mở slot";
    else if (l.is_full) suffix = ` (${l.current_count ?? 0}/${l.quota} SV) — Đầy`;
    else if (l.quota != null) suffix = ` (${l.current_count ?? 0}/${l.quota} SV)`;
    return `${l.full_name}${suffix}`;
  }

  const selectedLecturer = lecturers.find((l) => l.id === form.supervisor_id);

  const allLecturerOptions = [
    ...suggestedLecturers.map((l) => ({ value: l.id, label: lecturerLabel(l), suggested: true })),
    ...otherLecturers.map((l) => ({ value: l.id, label: lecturerLabel(l), suggested: false })),
  ];

  const filteredOptions = allLecturerOptions.filter((o) =>
    o.label.toLowerCase().includes((supervisorSearch || "").toLowerCase())
  );

  return (
    <>
      <ToastContainer />
      <div className="max-w-5xl">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900">Đăng ký đề tài</h1>
          <p className="text-sm text-slate-500 mt-1">
            Điền đầy đủ thông tin và chọn giảng viên hướng dẫn phù hợp
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Lưu ý trước khi đăng ký</p>
            <ul className="mt-1 space-y-0.5 text-blue-600 text-xs list-disc list-inside">
              <li>Mỗi sinh viên chỉ được có một đề tài đang hoạt động</li>
              <li>Sau khi gửi, GVHD sẽ xem xét và xác nhận hướng dẫn</li>
              <li>Nếu GVHD từ chối, bạn có thể chọn lại giảng viên khác</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* CỘT TRÁI */}
          <div className="space-y-5">
          <Card title="Thông tin đề tài">
            <div className="space-y-4">
              <Select
                label="Loại đề tài *"
                value={form.topic_type}
                onChange={(e) => setForm({ ...form, topic_type: e.target.value as "KLTN" | "BCTT" })}
                options={topicTypeOptions}
                error={errors.topic_type}
              />

              {form.topic_type === "KLTN" && (
                <Select
                  label="Phân loại đề tài KLTN *"
                  value={form.topic_category}
                  onChange={(e) => setForm({ ...form, topic_category: e.target.value as "UNG_DUNG" | "NGHIEN_CUU" })}
                  options={topicCategoryOptions}
                />
              )}

              {form.topic_type === "KLTN" && hasPassedBctt === false && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Chưa đủ điều kiện đăng ký KLTN</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Bạn phải hoàn thành Báo cáo thực tập (BCTT) với kết quả Đạt trước khi đăng ký Khóa luận tốt nghiệp.
                    </p>
                  </div>
                </div>
              )}

              <Input
                label="Tên đề tài *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Xây dựng hệ thống quản lý sinh viên..."
                error={errors.title}
                hint={`${form.title.length}/200 ký tự`}
              />

              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Ngành</p>
                <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-800">
                  {form.department || "Đang tải..."}
                </div>
              </div>

              {/* Chọn đợt đăng ký */}
              {form.department && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Đợt đăng ký *</label>
                  {loadingTerms ? (
                    <p className="text-sm text-slate-400 italic">Đang tải danh sách đợt...</p>
                  ) : openTerms.length === 0 ? (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Hiện chưa có đợt đăng ký nào đang mở cho ngành <strong>{form.department}</strong> — {form.topic_type}. Vui lòng liên hệ trưởng bộ môn.</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {openTerms.map((t, idx) => {
                        const isSelected = selectedTerm?.Dot === t.Dot && selectedTerm?.Loaidetai === t.Loaidetai;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedTerm(t)}
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                            }`}
                          >
                            {t.Dot}
                            {t.StartReg && t.EndReg && (
                              <span className="block text-xs font-normal opacity-75 mt-0.5">
                                {t.StartReg} – {t.EndReg}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.term && <p className="text-xs text-red-500">{errors.term}</p>}
                </div>
              )}

              <Select
                label="Lĩnh vực *"
                value={form.field}
                onChange={(e) => setForm({ ...form, field: e.target.value, supervisor_id: "" })}
                options={fieldOptions}
                placeholder={form.department ? "-- Chọn lĩnh vực --" : "-- Chọn ngành trước --"}
                error={errors.field}
              />

              {form.topic_type === "BCTT" && (
                <Input
                  label="Tên công ty thực tập *"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Ví dụ: Công ty TNHH ABC Technology"
                  error={errors.company_name}
                />
              )}

              <Textarea
                label="Mô tả sơ lược đề tài"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                rows={3}
                placeholder="Mô tả ngắn gọn về mục tiêu và nội dung đề tài..."
              />
            </div>
          </Card>
          </div>{/* end cột trái */}

          {/* CỘT PHẢI */}
          <div className="space-y-5">
          <Card title="Giảng viên hướng dẫn">
            {form.topic_type === "KLTN" ? (
              bcttSupervisor ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Giảng viên hướng dẫn được tự động chỉ định</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      GVHD của KLTN sẽ là <strong>{bcttSupervisor.name}</strong> — giảng viên đã hướng dẫn BCTT của bạn.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-3">Đang tải thông tin giảng viên...</p>
              )
            ) : (
              <div className="space-y-3">
                {form.department && suggestedLecturers.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Đang hiển thị {suggestedLecturers.length} giảng viên phù hợp với ngành{form.field ? ` và lĩnh vực` : ""} đã chọn. Bạn vẫn có thể tìm giảng viên khác.
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Giảng viên hướng dẫn *</label>
                  <div ref={supervisorRef} className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        value={supervisorSearch || (selectedLecturer ? selectedLecturer.full_name : "")}
                        onChange={(e) => {
                          setSupervisorSearch(e.target.value);
                          setSupervisorOpen(true);
                          if (!e.target.value) setForm({ ...form, supervisor_id: "" });
                        }}
                        onFocus={() => setSupervisorOpen(true)}
                        placeholder="Gõ tên giảng viên để tìm..."
                        className="w-full px-3 py-2 pr-16 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {form.supervisor_id && (
                          <button type="button" onClick={() => { setForm({ ...form, supervisor_id: "" }); setSupervisorSearch(""); }}
                            className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    {supervisorOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                          <p className="text-sm text-slate-400 px-3 py-2 italic">Không tìm thấy giảng viên</p>
                        ) : (
                          <>
                            {filteredOptions.some((o) => o.suggested) && (
                              <p className="text-xs text-slate-400 px-3 pt-2 pb-1 font-medium border-b border-slate-100">
                                Gợi ý theo ngành{form.field ? " & lĩnh vực" : ""}
                              </p>
                            )}
                            {filteredOptions.filter((o) => o.suggested).map((o) => (
                              <button key={o.value} type="button"
                                onClick={() => { setForm({ ...form, supervisor_id: o.value }); setSupervisorSearch(""); setSupervisorOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 ${form.supervisor_id === o.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}>
                                {o.label}
                              </button>
                            ))}
                            {filteredOptions.some((o) => !o.suggested) && filteredOptions.some((o) => o.suggested) && (
                              <p className="text-xs text-slate-400 px-3 pt-2 pb-1 font-medium border-t border-slate-100">
                                Giảng viên khác
                              </p>
                            )}
                            {filteredOptions.filter((o) => !o.suggested).map((o) => (
                              <button key={o.value} type="button"
                                onClick={() => { setForm({ ...form, supervisor_id: o.value }); setSupervisorSearch(""); setSupervisorOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 ${form.supervisor_id === o.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}>
                                {o.label}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.supervisor_id && <p className="text-xs text-red-500">{errors.supervisor_id}</p>}
                </div>
                {form.supervisor_id && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Sau khi gửi, giảng viên sẽ nhận thông báo và xem xét xác nhận hướng dẫn. Bạn không thể thay đổi GVHD sau khi gửi.</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Hủy
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={form.topic_type === "KLTN" && hasPassedBctt === false}
              className="flex-1"
            >
              Gửi đăng ký
            </Button>
          </div>
          </div>{/* end cột phải */}
          </div>{/* end grid */}
        </form>
      </div>
    </>
  );
}
