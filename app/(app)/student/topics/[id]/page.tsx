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
import { formatDate, formatFileSize } from "@/lib/utils";
import {
  TOPIC_TYPE_LABELS,
  FILE_TYPE_LABELS,
} from "@/lib/constants";
import {
  ExternalLink,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { SubmitRevisionButton } from "./submit-revision-button";
import { RevisionUploadSection } from "./revision-upload-section";
import { CopyFilename } from "./copy-filename";

// Mô tả trạng thái để sinh viên hiểu rõ bước hiện tại
const STATUS_GUIDE: Record<
  string,
  { label: string; desc: string; color: string }
> = {
  DANG_THUC_HIEN: {
    label: "Đang thực hiện",
    desc: "Nộp bài khóa luận để GVHD kiểm tra và chấm điểm.",
    color: "blue",
  },
  CHO_CHAM_HUONG_DAN: {
    label: "Chờ GVHD chấm điểm",
    desc: "GVHD đang xem xét bài nộp của bạn. Vui lòng chờ kết quả.",
    color: "amber",
  },
  DA_CHAM_HUONG_DAN: {
    label: "GVHD đã chấm xong",
    desc: "GVHD đã chấm điểm. Đang chờ phân công giảng viên phản biện.",
    color: "green",
  },
  CHO_CHAM_PHAN_BIEN: {
    label: "Chờ GVPB chấm điểm",
    desc: "Giảng viên phản biện đang xem xét bài của bạn.",
    color: "amber",
  },
  DA_CHAM_PHAN_BIEN: {
    label: "GVPB đã chấm xong",
    desc: "Đang chờ hội đồng đánh giá.",
    color: "green",
  },
  CHO_HOI_DONG: {
    label: "Chờ hội đồng",
    desc: "Hội đồng đang xem xét hồ sơ của bạn.",
    color: "amber",
  },
  DANG_CHAM_HOI_DONG: {
    label: "Hội đồng đang chấm điểm",
    desc: "Các thành viên hội đồng đang chấm điểm. Kết quả sẽ được thư ký công bố sau khi hoàn tất.",
    color: "purple",
  },
  CAN_CHINH_SUA: {
    label: "Cần chỉnh sửa",
    desc: "Hội đồng yêu cầu chỉnh sửa. Upload KLTN đã chỉnh sửa và Biên bản giải trình rồi gửi cho GVHD.",
    color: "red",
  },
  CHO_GVHD_XAC_NHAN: {
    label: "Chờ GVHD xác nhận",
    desc: "GVHD đang xem xét bộ tài liệu chỉnh sửa của bạn. Vui lòng chờ phản hồi.",
    color: "amber",
  },
  CHO_CHU_TICH_DUYET: {
    label: "Chờ Chủ tịch HĐ phê duyệt",
    desc: "GVHD đã xác nhận. Hồ sơ đang chờ Chủ tịch Hội đồng phê duyệt lần cuối.",
    color: "amber",
  },
  CHO_THU_KY_XAC_NHAN: {
    label: "Chờ Thư ký xác nhận hoàn tất",
    desc: "Chủ tịch Hội đồng đã phê duyệt. Thư ký đang xác nhận hoàn tất điểm và bản chỉnh sửa.",
    color: "green",
  },
  HOAN_TAT: {
    label: "Hoàn tất",
    desc: "Chúc mừng! Bạn đã hoàn tất toàn bộ quy trình KLTN.",
    color: "green",
  },
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  green: "bg-green-50 border-green-200 text-green-800",
  red: "bg-red-50 border-red-200 text-red-800",
  purple: "bg-purple-50 border-purple-200 text-purple-800",
};

export default async function StudentTopicDetail({
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
  if (topic.student_id !== userId) redirect("/student/status");

  const [studentUser, supervisor, reviewer, files, histories, scores, revisions] =
    await Promise.all([
      db.users.findById(userId),
      topic.supervisor_id ? db.users.findById(topic.supervisor_id) : null,
      topic.reviewer_id ? db.users.findById(topic.reviewer_id) : null,
      db.files.filter({ topic_id: id }),
      db.statusHistories.filter({ topic_id: id }),
      db.scores.filter({ topic_id: id }),
      db.revisions.filter({ topic_id: id }),
    ]);

  const mssv = studentUser?.student_code ?? "MSSV";
  const major = studentUser?.major ?? "NGÀNH";

  const supervisorScore = scores.find((s) => s.score_role === "SUPERVISOR");
  const reviewerScore = scores.find((s) => s.score_role === "REVIEWER");

  // Phân loại file
  const thesisFiles = files.filter((f) => f.file_type === "KHOA_LUAN");
  const turnitinFiles = files.filter((f) => f.file_type === "TURNITIN");
  const councilFeedbackFiles = files.filter((f) => f.file_type === "NHAN_XET_HOI_DONG");
  const otherFiles = files.filter(
    (f) => !["KHOA_LUAN", "TURNITIN", "BAI_BAO", "NHAN_XET_HOI_DONG"].includes(f.file_type),
  );

  const isBCTT = topic.topic_type === "BCTT";
  const canUploadThesis = topic.current_status === "DANG_THUC_HIEN";
  // SV upload bất cứ lúc nào trừ HOAN_TAT. Nếu đã gửi → upload đè file, KHÔNG cần Gửi lại.
  const canUploadRevision = topic.current_status !== "HOAN_TAT";
  const alreadySubmittedRevision = [
    "CHO_GVHD_XAC_NHAN",
    "CHO_CHU_TICH_DUYET",
    "CHO_THU_KY_XAC_NHAN",
  ].includes(topic.current_status);
  const canResubmitDueToPlagiarism =
    !isBCTT &&
    topic.current_status === "CHO_CHAM_HUONG_DAN" &&
    turnitinFiles.length > 0;

  // Files cho phần chỉnh sửa
  const chinhSuaFiles = files.filter((f) => f.file_type === "CHINH_SUA");
  const bienBanFiles = files.filter((f) => f.file_type === "BIEN_BAN_HOI_DONG");
  const giaiTrinhFiles = files.filter((f) => f.file_type === "PHIEU_GIAI_TRINH");
  const hasSubmitted = thesisFiles.length > 0;

  const bcttFiles = files.filter((f) => f.file_type === "BAO_CAO");
  const xacNhanFiles = files.filter((f) => f.file_type === "XAC_NHAN");

  const historiesWithNames = await Promise.all(
    histories.map(async (h) => {
      const changer = h.changed_by
        ? await db.users.findById(h.changed_by)
        : null;
      return { ...h, changer_name: changer?.full_name };
    }),
  );

  const pendingRevision = revisions.find(
    (r) => r.is_approved !== "true" && !r.revised_file_id,
  );
  const guide = STATUS_GUIDE[topic.current_status];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
            {TOPIC_TYPE_LABELS[topic.topic_type as "KLTN" | "BCTT"]}
          </span>
          <TopicStatusBadge
            status={topic.current_status}
            type={topic.topic_type as "KLTN" | "BCTT"}
          />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{topic.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Năm học {topic.academic_year} · Học kỳ {topic.semester} · Đợt{" "}
          {topic.batch}· Đăng ký {formatDate(topic.created_at)}
        </p>
      </div>

      {/* Hướng dẫn bước hiện tại */}
      {guide && (
        <div
          className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${COLOR_MAP[guide.color]}`}
        >
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">{guide.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{guide.desc}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-5">
          {/* Thông tin đề tài */}
          <Card title="Thông tin đề tài">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">
                  Lĩnh vực
                </dt>
                <dd className="font-medium text-slate-800">
                  {topic.field || "—"}
                </dd>
              </div>
              {topic.topic_type === "KLTN" && topic.topic_category && (
                <div>
                  <dt className="text-slate-400 text-xs font-medium mb-0.5">
                    Phân loại
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {topic.topic_category === "UNG_DUNG" ? "Đề tài ứng dụng" : "Đề tài nghiên cứu"}
                  </dd>
                </div>
              )}
              {topic.company_name && (
                <div>
                  <dt className="text-slate-400 text-xs font-medium mb-0.5">
                    Công ty
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {topic.company_name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">
                  GVHD
                </dt>
                <dd className="font-medium text-slate-800">
                  {supervisor?.full_name ?? "Chưa phân công"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">
                  GVPB
                </dt>
                <dd className="font-medium text-slate-800">
                  {reviewer?.full_name ?? "Chưa phân công"}
                </dd>
              </div>
              {topic.summary && (
                <div className="col-span-2">
                  <dt className="text-slate-400 text-xs font-medium mb-0.5">
                    Mô tả
                  </dt>
                  <dd className="text-slate-700">{topic.summary}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* ====== NỘP BÀI (KLTN) — do GVHD upload thay SV ====== */}
          {canUploadThesis && !isBCTT && (
            <Card title="📋 Trạng thái nộp bài khóa luận">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                <p className="font-medium mb-1">Bài khóa luận sẽ được GVHD nộp thay cho bạn.</p>
                <p className="text-xs opacity-90">Vui lòng gửi file cho GVHD để được upload lên hệ thống.</p>
              </div>
              {hasSubmitted && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  GVHD đã nộp {thesisFiles.length} file khóa luận cho bạn.
                </div>
              )}
            </Card>
          )}

          {/* ====== NỘP BÀI (BCTT) — 2 file ====== */}
          {canUploadThesis && isBCTT && (
            <Card title="📤 Nộp hồ sơ Báo cáo thực tập">
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                  <p className="font-medium mb-1">Yêu cầu nộp 2 file:</p>
                  <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                    <li><strong>File 1:</strong> Bài Báo Cáo Thực Tập (PDF hoặc Word) nộp cho giảng viên</li>
                    <li><strong>File 2:</strong> Phiếu xác nhận thực tập có đóng dấu của công ty</li>
                  </ul>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    File 1: Bài Báo Cáo Thực Tập
                  </p>
                  <CopyFilename filename={`${mssv}_${major}_BCTT`} />
                  <FileUpload
                    topicId={id}
                    fileType="BAO_CAO"
                    label="Báo cáo thực tập"
                    accept=".pdf,.doc,.docx"
                  />
                  {bcttFiles.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Đã nộp {bcttFiles.length} file báo cáo.
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    File 2: Phiếu xác nhận thực tập của công ty
                  </p>
                  <p className="text-xs text-slate-500">
                    File scan hoặc ảnh phiếu xác nhận có đóng dấu của công ty nơi thực tập.
                  </p>
                  <CopyFilename filename={`${mssv}_PXN_${major}`} />
                  <FileUpload
                    topicId={id}
                    fileType="XAC_NHAN"
                    label="Phiếu xác nhận thực tập"
                    accept=".pdf"
                  />
                  {xacNhanFiles.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Đã nộp phiếu xác nhận.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ====== YÊU CẦU CHỈNH SỬA ====== */}
          {pendingRevision && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-1">
                ⚠️ Yêu cầu chỉnh sửa từ hội đồng
              </p>
              <p className="text-sm text-orange-700">
                {pendingRevision.request_note}
              </p>
              <p className="text-xs text-orange-500 mt-2">
                Vui lòng upload bản chỉnh sửa bên dưới sau khi hoàn chỉnh.
              </p>
            </div>
          )}

          {canUploadRevision && (
            <Card title="📤 Nộp tài liệu chỉnh sửa">
              <RevisionUploadSection
                topicId={id}
                initialHasChinhSua={chinhSuaFiles.length > 0}
                initialHasGiaiTrinh={giaiTrinhFiles.length > 0}
                alreadySubmitted={alreadySubmittedRevision}
              />
            </Card>
          )}


          {/* ====== NỘP LẠI KLTN KHI ĐẠO VĂN VƯỢT MỨC ====== */}
          {canResubmitDueToPlagiarism && (
            <Card title="📤 Nộp lại KLTN do tỷ lệ đạo văn vượt mức">
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <p className="font-medium mb-1">⚠️ Tỷ lệ đạo văn vượt mức cho phép</p>
                  <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                    <li>GVHD đã kiểm tra và phát hiện tỷ lệ đạo văn vượt mức quy định</li>
                    <li>Bạn cần chỉnh sửa lại bài và nộp lại bản mới</li>
                    <li>Liên hệ GVHD để biết cụ thể phần cần chỉnh sửa</li>
                  </ul>
                </div>
                <FileUpload
                  topicId={id}
                  fileType="KHOA_LUAN"
                  label="KLTN đã chỉnh sửa (nộp lại)"
                  accept=".pdf,.doc,.docx"
                />
                {thesisFiles.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Đã nộp {thesisFiles.length} file. GVHD sẽ kiểm tra lại bản mới.
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ====== BIÊN BẢN HỘI ĐỒNG TỪ THƯ KÝ ====== */}
          {bienBanFiles.length > 0 && (
            <Card title="📋 Biên bản hội đồng">
              <div className="space-y-2">
                {bienBanFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                        <p className="text-xs text-slate-400">
                          Biên bản từ Thư ký hội đồng · {formatDate(f.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Tải về
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ====== NHẬN XÉT GÓP Ý TỪ HỘI ĐỒNG ====== */}
          {councilFeedbackFiles.length > 0 && (
            <Card title="📝 Nhận xét góp ý từ Hội đồng">
              <div className="space-y-2">
                {councilFeedbackFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.original_name}</p>
                        <p className="text-xs text-slate-400">
                          Nhận xét góp ý từ Chủ tịch Hội đồng · {formatDate(f.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Tải về
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* Timeline */}
        <div>
          <Card title="Tiến trình">
            <StatusTimeline
              items={
                historiesWithNames as Parameters<
                  typeof StatusTimeline
                >[0]["items"]
              }
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
