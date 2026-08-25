import ImageModule from "docxtemplater-image-module-free";
import { downloadFileFromDrive } from "@/lib/drive-client";

/**
 * Phát hiện định dạng ảnh từ magic bytes (PNG/JPEG/GIF).
 * Mặc định trả về "png" nếu không nhận diện được.
 */
function detectImageExt(buf: Buffer): "png" | "jpeg" | "gif" {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "gif";
  }
  return "png";
}

/**
 * Tạo image module + object data chữ ký để truyền vào docxtemplater.
 *
 * Cách hoạt động của docxtemplater-image-module-free (sync):
 *  - Khi gặp {%chu_ky_xxx}, nó tra data.chu_ky_xxx làm "tagValue".
 *  - Nếu tagValue falsy → module trả về text trống (không render ảnh).
 *  - Nếu tagValue là object → module tưởng là async pre-resolved và crash.
 *  - Phải là **primitive truthy (string)** → module mới gọi getImage(tagValue, tagName).
 * Vì vậy ta đặt data[key] = tên tag (string truthy), rồi trong getImage dùng
 * tham số `tagName` để tra ngược Buffer từ closure.
 *
 * Lưu ý: module hardcode tên ảnh là ".png" → nếu user upload JPG thì Word không
 * render được. Ta detect magic bytes và override getNextImageName để đặt đúng
 * extension cho file trong docx (png/jpeg/gif).
 */
export function createSignatureHandler(signatures: Record<string, Buffer | null>) {
  const data: Record<string, string> = {};
  for (const [key, buf] of Object.entries(signatures)) {
    data[key] = buf ? key : "";
  }

  let lastExt: "png" | "jpeg" | "gif" = "png";

  const module = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage: (_tagValue: unknown, tagName?: string) => {
      const buf = tagName ? signatures[tagName] : null;
      if (!buf) {
        return Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64",
        );
      }
      lastExt = detectImageExt(buf);
      return buf;
    },
    getSize: (_img: unknown, _tagValue: unknown, tagName?: string) => {
      return (tagName && signatures[tagName] ? [200, 80] : [1, 1]) as [number, number];
    },
  });

  const anyModule = module as unknown as { getNextImageName: () => string };
  const origGetName = anyModule.getNextImageName.bind(module);
  anyModule.getNextImageName = () => origGetName().replace(/\.png$/, `.${lastExt}`);

  return { module, data };
}

/**
 * Lấy buffer chữ ký từ Drive theo signature_file_id của user.
 * Trả về null nếu user không có chữ ký hoặc lỗi.
 */
export async function fetchSignatureBuffer(
  signatureFileId: string | undefined | null,
): Promise<Buffer | null> {
  if (!signatureFileId) {
    console.log("[signature] không có signature_file_id");
    return null;
  }
  try {
    const buf = await downloadFileFromDrive(signatureFileId);
    const ext = detectImageExt(buf);
    console.log(
      `[signature] fileId=${signatureFileId} size=${buf.length}B ext=${ext}`,
    );
    return buf;
  } catch (e) {
    console.error(`[signature] tải fileId=${signatureFileId} lỗi:`, e);
    return null;
  }
}
