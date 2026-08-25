import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  // Dùng Desktop app credentials + refresh token của admin
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  oauth2.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });
  return google.drive({ version: "v3", auth: oauth2 });
}

/**
 * Tạo folder trên Google Drive, trả về folderId
 */
export async function createDriveFolder(
  name: string,
  parentId: string,
): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  const folderId = res.data.id;
  if (!folderId) throw new Error(`Không thể tạo folder "${name}"`);
  return folderId;
}

/**
 * Share folder công khai — Anyone with the link can edit
 */
export async function shareFolderPublic(folderId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      role: "writer",
      type: "anyone",
    },
  });
}

/**
 * Chuyển folderId thành URL Google Drive
 */
export function getFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Lấy folderId từ URL
 */
export function getFolderIdFromUrl(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * Tìm hoặc tạo subfolder trong parent
 */
export async function getOrCreateSubfolder(
  parentId: string,
  name: string,
): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }
  return createDriveFolder(name, parentId);
}

/**
 * Upload file lên Google Drive vào folder chỉ định
 * Trả về { fileId, fileUrl } — URL dạng view công khai
 */
export async function uploadFileToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const drive = getDriveClient();

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Upload thất bại: không lấy được fileId");

  // Cho phép anyone xem
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
  return { fileId, fileUrl };
}

/**
 * Xoá file trên Drive theo fileId
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/**
 * Tạo phiên upload resumable — trả về uploadUrl cho client dùng PUT trực tiếp.
 * Bypass Vercel body limit: file không đi qua Vercel, upload thẳng lên Drive.
 */
export async function createResumableUploadSession(
  fileName: string,
  mimeType: string,
  folderId: string,
  fileSize?: number,
): Promise<string> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

  const { token } = await oauth2.getAccessToken();
  if (!token) throw new Error("Không lấy được access token cho Drive");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": mimeType,
  };
  if (fileSize) headers["X-Upload-Content-Length"] = String(fileSize);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive resumable session thất bại: ${res.status} ${errText}`);
  }

  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) throw new Error("Drive không trả về uploadUrl (Location header)");
  return uploadUrl;
}

/**
 * Tải nội dung file từ Google Drive về Buffer
 */
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" },
  );
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    (response.data as NodeJS.ReadableStream)
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}

/**
 * Đặt quyền đọc công khai cho file, trả về URL view.
 */
export async function makeFilePublic(fileId: string): Promise<string> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
  return `https://drive.google.com/file/d/${fileId}/view`;
}
