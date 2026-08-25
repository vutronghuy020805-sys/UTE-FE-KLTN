import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Edge Runtime: không buffer body → không giới hạn kích thước file
export const runtime = "edge";

const ALLOWED_PREFIX = "https://www.googleapis.com/upload/drive/v3/files";

export async function POST(request: NextRequest) {
  // Auth qua JWT cookie (next-auth/jwt hoạt động trong Edge)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const driveUploadUrl = request.headers.get("x-drive-upload-url");
  if (!driveUploadUrl) {
    return Response.json({ error: "Thiếu Drive upload URL" }, { status: 400 });
  }

  // SSRF protection: chỉ cho phép Google Drive upload URL
  if (!driveUploadUrl.startsWith(ALLOWED_PREFIX)) {
    return Response.json({ error: "URL không hợp lệ" }, { status: 400 });
  }

  if (!request.body) {
    return Response.json({ error: "Không có file" }, { status: 400 });
  }

  // Lấy Content-Type từ request (trình duyệt tự set theo loại file)
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const fileSize = request.headers.get("x-file-size");
  // X-Content-Range: vị trí chunk trong file lớn, vd "bytes 0-3145727/9663488"
  const contentRange = request.headers.get("x-content-range");

  // Stream thẳng body lên Google Drive — không buffer vào RAM
  const driveRes = await fetch(driveUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...(fileSize ? { "Content-Length": fileSize } : {}),
      ...(contentRange ? { "Content-Range": contentRange } : {}),
    },
    body: request.body,
  });

  // 308 Resume Incomplete = Drive nhận chunk trung gian thành công, chờ chunk tiếp theo
  if (driveRes.status === 308) {
    return Response.json({ ok: true });
  }

  if (!driveRes.ok) {
    const errText = await driveRes.text();
    console.error("Drive stream error:", driveRes.status, errText);
    return Response.json({ error: `Upload Drive thất bại (${driveRes.status})` }, { status: 500 });
  }

  const driveData = (await driveRes.json()) as { id?: string };
  if (!driveData.id) {
    return Response.json({ error: "Drive không trả về fileId" }, { status: 500 });
  }

  return Response.json({ driveFileId: driveData.id });
}
