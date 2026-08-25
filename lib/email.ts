import nodemailer from "nodemailer";

export async function sendGenericEmail({
  to,
  subject,
  title,
  content,
  deadlineFormatted,
  daysLeft,
}: {
  to: string;
  subject: string;
  title: string;
  content: string;
  deadlineFormatted: string;
  daysLeft: number;
}): Promise<void> {
  const urgencyColor =
    daysLeft === 1 ? "#dc2626" : daysLeft === 2 ? "#d97706" : "#2563eb";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:${urgencyColor};padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:700;line-height:1.3">⏰ ${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 36px;background:#fefce8;border-bottom:1px solid ${urgencyColor}30">
          <p style="margin:0;font-size:13px;color:${urgencyColor};font-weight:600">
            Hạn: ${deadlineFormatted} — Còn ${daysLeft} ngày
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <div style="font-size:14px;color:#334155;line-height:1.8;white-space:pre-wrap">${content}</div>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:14px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export type RevisionReminderRole = "GVHD" | "CHAIR";

export async function sendRevisionReviewReminderEmail({
  to,
  recipientName,
  topics,
  role = "GVHD",
}: {
  to: string;
  recipientName: string;
  topics: TopicSummary[];
  role?: RevisionReminderRole;
}): Promise<void> {
  const config = role === "GVHD"
    ? {
        headerColor: "#d97706",
        bannerBg: "#fffbeb",
        bannerBorder: "#fde68a",
        bannerText: "#b45309",
        title: "📋 Nhắc duyệt tài liệu chỉnh sửa sau bảo vệ",
        intro: 'Sinh viên đã nộp tài liệu chỉnh sửa sau bảo vệ và đang chờ thầy/cô xét duyệt. Vui lòng đăng nhập hệ thống vào mục <strong>"Xét chỉnh sửa SV"</strong> ở thanh menu bên trái để xem 2 file (KLTN đã chỉnh sửa + Biên bản giải trình) và bấm <strong>Đồng ý</strong> hoặc <strong>Yêu cầu chỉnh sửa thêm</strong>.',
        nextStep: "Sau khi thầy/cô đồng ý, hồ sơ sẽ được chuyển tới Chủ tịch Hội đồng phê duyệt lần cuối.",
        subjectPrefix: "Nhắc duyệt chỉnh sửa sau bảo vệ",
      }
    : {
        headerColor: "#7c3aed",
        bannerBg: "#faf5ff",
        bannerBorder: "#e9d5ff",
        bannerText: "#6b21a8",
        title: "👑 Nhắc Chủ tịch HĐ phê duyệt cuối cùng",
        intro: 'GVHD đã xác nhận sinh viên hoàn tất chỉnh sửa và đang chờ thầy/cô (Chủ tịch Hội đồng) phê duyệt cuối cùng. Vui lòng đăng nhập hệ thống vào mục <strong>"Chủ tịch hội đồng"</strong> ở thanh menu bên trái để xem 2 file (KLTN đã chỉnh sửa + Biên bản giải trình) và bấm <strong>Phê duyệt</strong> hoặc <strong>Yêu cầu chỉnh sửa thêm</strong>.',
        nextStep: "Sau khi thầy/cô phê duyệt, đề tài sẽ chuyển sang trạng thái HOÀN TẤT.",
        subjectPrefix: "Nhắc Chủ tịch HĐ duyệt cuối cùng",
      };

  const topicRows = topics
    .map(
      (t, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
      <td style="padding:9px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${t.studentName}</td>
      <td style="padding:9px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">${t.studentCode}</td>
      <td style="padding:9px 14px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0">${t.title}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:${config.headerColor};padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:22px;font-weight:700;line-height:1.3">
            ${config.title}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="background:${config.bannerBg};padding:14px 36px;border-bottom:2px solid ${config.bannerBorder}">
          <p style="margin:0;font-size:14px;color:${config.bannerText};font-weight:600">
            ${topics.length} đề tài đang chờ thầy/cô duyệt
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
            Kính gửi <strong>${recipientName}</strong>,
          </p>
          <p style="margin:0 0 22px;font-size:14px;color:#475569;line-height:1.7">
            ${config.intro}
          </p>
          <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0f172a">
            Danh sách đề tài chờ duyệt (${topics.length}):
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Họ tên SV</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">MSSV</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Tên đề tài</th>
              </tr>
            </thead>
            <tbody>${topicRows}</tbody>
          </table>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
            ${config.nextStep}
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
            Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `[KLTN] ${config.subjectPrefix} – ${topics.length} đề tài`,
    html,
  });
}

export interface TopicSummary {
  title: string;
  studentName: string;
  studentCode: string;
}

export async function sendDeadlineReminderEmail({
  to,
  supervisorName,
  deadlineType,
  deadlineFormatted,
  daysLeft,
  topics,
  termLabel,
}: {
  to: string;
  supervisorName: string;
  deadlineType: string;
  deadlineFormatted: string;
  daysLeft: number;
  topics: TopicSummary[];
  termLabel: string;
}): Promise<void> {
  const urgencyColor =
    daysLeft === 1 ? "#dc2626" : daysLeft === 2 ? "#d97706" : "#2563eb";
  const urgencyBg =
    daysLeft === 1 ? "#fef2f2" : daysLeft === 2 ? "#fffbeb" : "#eff6ff";

  const topicRows = topics
    .map(
      (t, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
      <td style="padding:9px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${t.studentName}</td>
      <td style="padding:9px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0">${t.studentCode}</td>
      <td style="padding:9px 14px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0">${t.title}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr>
        <td style="background:${urgencyColor};padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:22px;font-weight:700;line-height:1.3">
            ⏰ Nhắc nhở: Còn ${daysLeft} ngày đến hạn nộp ${deadlineType}
          </h1>
        </td>
      </tr>

      <!-- Alert banner -->
      <tr>
        <td style="background:${urgencyBg};padding:14px 36px;border-bottom:2px solid ${urgencyColor}20">
          <p style="margin:0;font-size:14px;color:${urgencyColor};font-weight:600">
            Hạn nộp: ${deadlineFormatted} — Còn ${daysLeft} ngày
          </p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 36px">
          <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
            Kính gửi <strong>${supervisorName}</strong>,
          </p>
          <p style="margin:0 0 22px;font-size:14px;color:#475569;line-height:1.7">
            Hệ thống xin nhắc nhở về hạn nộp <strong>${deadlineType}</strong> của
            <strong>${termLabel}</strong>. Vui lòng đôn đốc sinh viên hoàn thành và nộp đúng hạn.
          </p>

          <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0f172a">
            Danh sách sinh viên bạn đang hướng dẫn (${topics.length} SV):
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Họ tên SV</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">MSSV</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Tên đề tài</th>
              </tr>
            </thead>
            <tbody>${topicRows}</tbody>
          </table>

          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
            Nếu có thắc mắc, vui lòng liên hệ bộ phận quản lý KLTN của khoa.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
            Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `[KLTN] Còn ${daysLeft} ngày đến hạn nộp ${deadlineType} – ${termLabel}`,
    html,
  });
}

export type CommitteeRoleLabel = "Chủ tịch" | "Thư ký" | "Thành viên";

export async function sendCommitteeAssignmentEmail({
  to,
  recipientName,
  role,
  committeeName,
  defenseDateFormatted,
  defenseSessionLabel,
  defenseLocation,
}: {
  to: string;
  recipientName: string;
  role: CommitteeRoleLabel;
  committeeName: string;
  defenseDateFormatted: string;
  defenseSessionLabel: string;
  defenseLocation: string;
}): Promise<void> {
  const sessionPart = defenseSessionLabel ? ` (${defenseSessionLabel})` : "";
  const locationPart = defenseLocation || "(chưa cập nhật)";
  const datePart = defenseDateFormatted || "(chưa cập nhật)";

  const bodyText = `Kính gửi Thầy/Cô ${recipientName},

Thầy/Cô được phân công với vai trò ${role} của hội đồng ${committeeName} - Phòng ${locationPart} ngày ${datePart}${sessionPart}, bắt đầu từ 7h30.

Cảm ơn quý Thầy/Cô.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#2563eb;padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:700;line-height:1.3">Phân công Hội đồng bảo vệ</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">Kính gửi Thầy/Cô <strong>${recipientName}</strong>,</p>
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">
            Thầy/Cô được phân công với vai trò <strong style="color:#2563eb">${role}</strong> của hội đồng <strong>${committeeName}</strong> - Phòng <strong>${locationPart}</strong> ngày <strong>${datePart}</strong>${sessionPart}, bắt đầu từ <strong>7h30</strong>.
          </p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7">Cảm ơn quý Thầy/Cô.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:14px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `[KLTN] Phân công ${role} hội đồng ${committeeName}`,
    html,
    text: bodyText,
  });
}

export async function sendKltnFailedEmail({
  to,
  studentName,
  role,
}: {
  to: string;
  studentName: string;
  role: "GVHD" | "GVPB";
}): Promise<void> {
  const roleLabel = role === "GVHD" ? "GVHD" : "GVPB";

  const bodyText = `Thân gửi bạn ${studentName},

${roleLabel} chấm điểm KLTN của bạn là: KHÔNG ĐẠT

Trân trọng.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#dc2626;padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:700;line-height:1.3">Kết quả chấm điểm KLTN</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">Thân gửi bạn <strong>${studentName}</strong>,</p>
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">
            <strong>${roleLabel}</strong> chấm điểm KLTN của bạn là: <strong style="color:#dc2626">KHÔNG ĐẠT</strong>
          </p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7">Trân trọng.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:14px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `[KLTN] Kết quả chấm điểm ${roleLabel}: KHÔNG ĐẠT`,
    html,
    text: bodyText,
  });
}

export type RevisionRejector = "GVHD" | "Chủ tịch HĐ";

export async function sendRevisionRejectedEmail({
  to,
  studentName,
  rejector,
  rejectorName,
  topicTitle,
  reason,
}: {
  to: string;
  studentName: string;
  rejector: RevisionRejector;
  rejectorName: string;
  topicTitle: string;
  reason: string;
}): Promise<void> {
  const bodyText = `Thân gửi bạn ${studentName},

${rejector} ${rejectorName ? `(${rejectorName}) ` : ""}KHÔNG đồng ý với bản chỉnh sửa của khóa luận "${topicTitle}".

Lý do: ${reason || "(không có ghi chú)"}

Vui lòng upload lại bộ tài liệu chỉnh sửa (KLTN đã chỉnh sửa + Biên bản giải trình) trên hệ thống.

Trân trọng.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#dc2626;padding:28px 36px">
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;letter-spacing:0.05em;text-transform:uppercase">Hệ thống Quản lý KLTN</p>
          <h1 style="margin:10px 0 0;color:#fff;font-size:20px;font-weight:700;line-height:1.3">Bản chỉnh sửa chưa được duyệt</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px">
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">Thân gửi bạn <strong>${studentName}</strong>,</p>
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7">
            <strong style="color:#dc2626">${rejector}</strong>${rejectorName ? ` (${rejectorName})` : ""} <strong>KHÔNG đồng ý</strong> với bản chỉnh sửa của khóa luận:
          </p>
          <p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.7;font-style:italic;background:#f8fafc;border-left:3px solid #dc2626;padding:10px 14px">
            "${topicTitle}"
          </p>
          <p style="margin:0 0 6px;font-size:13px;color:#64748b">Lý do:</p>
          <p style="margin:0 0 14px;font-size:14px;color:#0f172a;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;line-height:1.6;white-space:pre-wrap">${reason || "(không có ghi chú)"}</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.7">
            Vui lòng upload lại bộ tài liệu chỉnh sửa (KLTN đã chỉnh sửa + Biên bản giải trình) trên hệ thống. Quy trình sẽ bắt đầu lại từ bước xác nhận của GVHD.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;padding:14px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Email tự động từ Hệ thống Quản lý KLTN. Vui lòng không trả lời email này.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Hệ thống KLTN"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `[KLTN] ${rejector} không đồng ý bản chỉnh sửa — vui lòng nộp lại`,
    html,
    text: bodyText,
  });
}
