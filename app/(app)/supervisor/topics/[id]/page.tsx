export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/sheets/client";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/index";
import {
  TopicStatusBadge,
  StatusTimeline,
} from "@/components/domain/topic-components";
import { FileUpload } from "@/components/domain/file-upload";
import { CriteriaScoreForm } from "@/components/domain/criteria-score-form";
import { BcttScoreForm } from "@/components/domain/bctt-score-form";
import { ResendToChairButton } from "./revision-review-buttons";
import { formatDate, formatFileSize } from "@/lib/utils";
import { FILE_TYPE_LABELS, SHEET_NAMES } from "@/lib/constants";
import { fetchCriteriaSheet } from "@/lib/sheets/client";
import type { CriterionDef } from "@/components/domain/criteria-score-form";
import { ExternalLink, FileText, ShieldCheck, Download } from "lucide-react";

export default async function SupervisorTopicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const topic = await db.topics.findById(id);
  if (!topic) notFound();
  if (topic.supervisor_id !== userId) redirect("/supervisor/students");

  // Đọc tiêu chí chấm điểm từ Google Sheets theo loại đề tài
  let supervisorCriteria: CriterionDef[] = [];
  {
    const sheetName = topic.topic_category === "NGHIEN_CUU"
      ? SHEET_NAMES.BB_GVHD_NGHIEN_CUU
      : SHEET_NAMES.BB_GVHD_UNG_DUNG;
    try {
      const rows = await fetchCriteriaSheet(sheetName);
      supervisorCriteria = rows.map((r, i) => ({
        key: `tc${i + 1}`,
        label: r.label,
        maxScore: r.maxScore,
        ...(r.rubric ? { rubric: r.rubric } : {}),
      }));
    } catch { /* dùng tiêu chí mặc định nếu sheet chưa có */ }
  }

  const [student, files, histories, scores] = await Promise.all([
    db.users.findById(topic.student_id),
    db.files.filter({ topic_id: id }),
    db.statusHistories.filter({ topic_id: id }),
    db.scores.filter({ topic_id: id }),
  ]);

  const myScore = scores.find(
    (s) => s.score_role === "SUPERVISOR" && s.scorer_id === userId,
  );

  const isBCTT = topic.topic_type === "BCTT";

  // Phân loại file
  const thesisFiles = files.filter((f) => f.file_type === "KHOA_LUAN");
  const bcttFiles = files.filter((f) => f.file_type === "BAO_CAO");
  const xacNhanFiles = files.filter((f) => f.file_type === "XAC_NHAN");
  const turnitinFiles = files.filter((f) => f.file_type === "TURNITIN");
  const chinhSuaFiles = files.filter((f) => f.file_type === "CHINH_SUA");
  const bienBanFiles = files.filter((f) => f.file_type === "BIEN_BAN_HOI_DONG");
  const giaiTrinhFiles = files.filter((f) => f.file_type === "PHIEU_GIAI_TRINH");
  const otherFiles = files.filter(
    (f) => !["KHOA_LUAN", "BAO_CAO", "XAC_NHAN", "TURNITIN", "BAI_BAO", "CHINH_SUA", "BIEN_BAN_HOI_DONG", "PHIEU_GIAI_TRINH"].includes(f.file_type),
  );

  const canResendToChair = topic.current_status === "CHO_CHU_TICH_DUYET";
  const canUploadKhoaLuan = !isBCTT && topic.current_status === "DANG_THUC_HIEN";

  // Số file sinh viên đã nộp (để kiểm tra cho phép chấm/upload Turnitin)
  const studentSubmittedCount = isBCTT
    ? bcttFiles.length + xacNhanFiles.length
    : thesisFiles.length;

  const canScore = true;

  // Có thể upload Turnitin khi SV đã nộp bài
  const canUploadTurnitin =
    studentSubmittedCount > 0 &&
    ["CHO_CHAM_HUONG_DAN", "DA_CHAM_HUONG_DAN", "DA_NOP_BAI"].includes(
      topic.current_status,
    );

  const historiesWithNames = await Promise.all(
    histories.map(async (h) => {
      const changer = h.changed_by
        ? await db.users.findById(h.changed_by)
        : null;
      return { ...h, changer_name: changer?.full_name };
    }),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
            {topic.topic_type === "KLTN"
              ? "Khóa luận tốt nghiệp"
              : "Báo cáo thực tập"}
          </span>
          <TopicStatusBadge
            status={topic.current_status}
            type={topic.topic_type as "KLTN" | "BCTT"}
          />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
      </div>

      {/* ====== BCTT LAYOUT: 2 cột ngang (điểm | hồ sơ) ====== */}
      {isBCTT && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trái: Nhập điểm */}
          <Card title={myScore ? "✏️ Cập nhật điểm báo cáo thực tập" : "⭐ Nhập điểm báo cáo thực tập"}>
            <BcttScoreForm
              topicId={id}
              existingScore={myScore ? Number(myScore.score_value) : undefined}
              existingComment={myScore?.comment}
            />
          </Card>

          {/* Phải: Hồ sơ SV nộp */}
          <Card title="Hồ sơ Báo cáo thực tập sinh viên nộp">
            {bcttFiles.length === 0 && xacNhanFiles.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sinh viên chưa nộp hồ sơ thực tập</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">File 1 — Bài Báo Cáo Thực Tập</p>
                  {bcttFiles.length === 0 ? (
                    <p className="text-sm text-slate-400 italic px-2">Chưa nộp</p>
                  ) : (
                    <div className="space-y-2">
                      {bcttFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{f.original_name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap ml-2">
                            <ExternalLink className="w-3.5 h-3.5" /> Xem
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">File 2 — Phiếu Xác Nhận Thực Tập</p>
                  {xacNhanFiles.length === 0 ? (
                    <p className="text-sm text-slate-400 italic px-2">Chưa nộp</p>
                  ) : (
                    <div className="space-y-2">
                      {xacNhanFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-green-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{f.original_name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium whitespace-nowrap ml-2">
                            <ExternalLink className="w-3.5 h-3.5" /> Xem
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ====== KLTN: score full width ====== */}
      {!isBCTT && canScore && (
        <Card title={myScore ? "✏️ Cập nhật điểm hướng dẫn" : "⭐ Nhập điểm hướng dẫn"}>
          {!myScore && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-700">
              <p className="font-medium mb-1">Lưu ý khi chấm điểm:</p>
              <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                <li>Tổng điểm &gt; 5.0 = Đạt, sinh viên chuyển sang bước phản biện</li>
                <li>Tổng điểm ≤ 5.0 = Không đạt, hồ sơ dừng lại</li>
                <li>Có thể cập nhật điểm sau khi đã lưu</li>
              </ul>
            </div>
          )}
          <CriteriaScoreForm
            topicId={id}
            role="SUPERVISOR"
            existingScore={myScore ? Number(myScore.score_value) : undefined}
            existingComment={myScore?.comment}
            customCriteria={supervisorCriteria.length > 0 ? supervisorCriteria : undefined}
          />
          {myScore && (
            <a
              href={`/api/download/bb-gvhd/${id}`}
              className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Tải biên bản Word (GVHD)
            </a>
          )}
        </Card>
      )}

      {/* ====== ĐIỂM ĐÃ CHẤM KLTN (full-width, khi không còn trong trạng thái chấm) ====== */}
      {myScore && !canScore && !isBCTT && (
        <Card title="✏️ Điểm hướng dẫn">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className={`w-28 text-center text-4xl font-black border-2 rounded-2xl px-3 py-3 ${Number(myScore.score_value) > 5 ? "border-green-400 text-green-700 bg-green-50" : "border-red-400 text-red-700 bg-red-50"}`}>
              {Number(myScore.score_value).toFixed(1)}
            </div>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${Number(myScore.score_value) > 5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {Number(myScore.score_value) > 5 ? "Đạt" : "Không đạt"}
            </span>
          </div>
          {myScore.comment && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-1">Nhận xét</p>
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{myScore.comment}</p>
            </div>
          )}
          <a
            href={`/api/download/bb-gvhd/${id}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Tải biên bản Word (GVHD)
          </a>
        </Card>
      )}

      {/* ====== KLTN only: grid 3 cột ====== */}
      {!isBCTT && <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          {/* ====== GVHD UPLOAD KLTN THAY SV ====== */}
          {canUploadKhoaLuan && (
            <Card title="📤 Nộp bài khóa luận cho sinh viên">
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                  <p className="text-xs opacity-90">Nhận file từ sinh viên và upload lên hệ thống. Sau khi upload, trạng thái sẽ chuyển sang <strong>Chờ chấm hướng dẫn</strong> để bạn có thể chấm điểm.</p>
                </div>
                <FileUpload
                  topicId={id}
                  fileType="KHOA_LUAN"
                  label="Bài khóa luận"
                  accept=".pdf,.doc,.docx"
                />
              </div>
            </Card>
          )}

          {/* ====== HỒ SƠ KLTN (gộp khóa luận + Turnitin) ====== */}
          {!isBCTT && (
            <Card title="Hồ sơ khóa luận sinh viên nộp">
              <div className="space-y-4">
                {/* File 1: Bài khóa luận */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    File 1 — Bài Khóa Luận
                  </p>
                  {thesisFiles.length === 0 ? (
                    <p className="text-sm text-slate-400 italic px-2">Chưa nộp</p>
                  ) : (
                    <div className="space-y-2">
                      {thesisFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(Number(f.file_size))} · Nộp lúc {formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                            <ExternalLink className="w-3.5 h-3.5" /> Tải về & xem
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* File 2: Turnitin */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    File 2 — Kiểm Tra Đạo Văn (Turnitin)
                  </p>
                  {turnitinFiles.length === 0 ? (
                    canUploadTurnitin ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">Upload báo cáo Turnitin sau khi kiểm tra đạo văn. Sinh viên sẽ thấy kết quả này.</p>
                        <FileUpload topicId={id} fileType="TURNITIN" label="Báo cáo Turnitin" accept=".pdf" />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic px-2">Chưa upload</p>
                    )
                  ) : (
                    <div className="space-y-2">
                      {turnitinFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                              <p className="text-xs text-slate-400">{formatDate(f.uploaded_at)}</p>
                            </div>
                          </div>
                          <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap">
                            <ExternalLink className="w-3.5 h-3.5" /> Tải về & xem
                          </a>
                        </div>
                      ))}
                      {canUploadTurnitin && (
                        <div className="pt-2">
                          <FileUpload topicId={id} fileType="TURNITIN" label="Cập nhật Turnitin" accept=".pdf" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ====== BIÊN BẢN HỘI ĐỒNG ====== */}
          {bienBanFiles.length > 0 && (
            <Card title="Biên bản hội đồng">
              <div className="space-y-2">
                {bienBanFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(Number(f.file_size))} · {formatDate(f.uploaded_at)}</p>
                      </div>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                      <ExternalLink className="w-3.5 h-3.5" /> Tải về & xem
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ====== GỬI LẠI CHO CHỦ TỊCH (CHO_CHU_TICH_DUYET) ====== */}
          {canResendToChair && !isBCTT && (
            <Card title="📋 Tài liệu chỉnh sửa đã gửi Chủ tịch">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                  Bạn đã xác nhận chỉnh sửa và 2 file đang chờ Chủ tịch hội đồng phê duyệt. Nhấn bên dưới nếu muốn gửi thông báo lại cho Chủ tịch.
                </div>
                {[
                  { label: "KLTN đã chỉnh sửa", files: chinhSuaFiles, color: "blue" },
                  { label: "Biên bản giải trình", files: giaiTrinhFiles, color: "green" },
                ].map(({ label, files: fList, color }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
                    {fList.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Chưa có file</p>
                    ) : (
                      <div className="space-y-1.5">
                        {fList.map((f) => (
                          <div key={f.id} className={`flex items-center justify-between p-2.5 bg-${color}-50 border border-${color}-200 rounded-lg`}>
                            <div className="flex items-center gap-2">
                              <FileText className={`w-4 h-4 text-${color}-500 shrink-0`} />
                              <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{f.original_name}</p>
                            </div>
                            <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                              <ExternalLink className="w-3.5 h-3.5" /> Tải về & xem
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100">
                  <ResendToChairButton topicId={id} />
                </div>
              </div>
            </Card>
          )}



          {/* Các file khác */}
          {otherFiles.length > 0 && (
            <Card title="Hồ sơ khác">
              <div className="space-y-2">
                {otherFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {f.original_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {
                            FILE_TYPE_LABELS[
                              f.file_type as keyof typeof FILE_TYPE_LABELS
                            ]
                          }{" "}
                          · {formatFileSize(Number(f.file_size))} ·{" "}
                          {formatDate(f.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Xem
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>}
    </div>
  );
}
