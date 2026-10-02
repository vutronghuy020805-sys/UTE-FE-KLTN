/**
 * Thu hồi quyền của tài khoản cũ (mặc định bmqtkd@hcmute.edu.vn) trên Sheet
 * và toàn bộ cây thư mục Drive gốc, dùng refresh token của tài khoản chủ sở hữu mới.
 *
 * Mặc định chỉ chạy thử (liệt kê, không xoá gì):
 *   node scripts/revoke-old-account-access.mjs
 * Thực sự thu hồi:
 *   node scripts/revoke-old-account-access.mjs --apply
 * Đổi email cần thu hồi:
 *   node scripts/revoke-old-account-access.mjs --email=abc@hcmute.edu.vn --apply
 */

import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter(line => line.includes("=") && !line.startsWith("#"))
    .map(line => { const [k, ...v] = line.split("="); return [k.trim(), v.join("=").trim()]; })
);

const APPLY = process.argv.includes("--apply");
const emailArg = process.argv.find(a => a.startsWith("--email="));
const TARGET_EMAIL = (emailArg ? emailArg.slice("--email=".length) : "bmqtkd@hcmute.edu.vn").toLowerCase();

const ROOT_FOLDER_ID = env.GOOGLE_DRIVE_ROOT_FOLDER_ID || env.GOOGLE_DRIVE_FOLDER_ID;
const SHEET_ID = env.GOOGLE_SHEET_ID;
const DRIVE = "https://www.googleapis.com/drive/v3";

// Lấy access token từ refresh token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: env.GOOGLE_DRIVE_CLIENT_ID,
    client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const { access_token, error } = await tokenRes.json();
if (error) { console.error("Lỗi lấy access token:", error); process.exit(1); }

async function api(path, init = {}, attempt = 0) {
  const res = await fetch(`${DRIVE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access_token}`, ...init.headers },
  });
  if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 5) {
    const body = await res.clone().text();
    if (res.status !== 403 || /rateLimitExceeded|userRateLimitExceeded/.test(body)) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      return api(path, init, attempt + 1);
    }
  }
  if (res.status === 204) return {};
  const data = await res.json();
  if (data.error) throw new Error(`${res.status} ${data.error.message}`);
  return data;
}

// Không cho chạy bằng chính token của tài khoản cần thu hồi
const about = await api("/about?fields=user(emailAddress)");
const me = about.user.emailAddress.toLowerCase();
console.log(`\nĐăng nhập bằng : ${me}`);
console.log(`Thu hồi quyền  : ${TARGET_EMAIL}`);
console.log(`Chế độ         : ${APPLY ? "THỰC HIỆN (--apply)" : "CHẠY THỬ (không xoá gì)"}\n`);
if (me === TARGET_EMAIL) {
  console.error("Refresh token đang thuộc chính tài khoản cần thu hồi. Dừng lại.");
  process.exit(1);
}

// Thu thập toàn bộ file/thư mục trong cây gốc
const items = new Map();
async function walk(folderId) {
  let pageToken;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const data = await api(
      `/files?q=${q}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "")
    );
    for (const f of data.files) {
      if (items.has(f.id)) continue;
      items.set(f.id, f);
      if (f.mimeType === "application/vnd.google-apps.folder") await walk(f.id);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
}

for (const id of [ROOT_FOLDER_ID, SHEET_ID].filter(Boolean)) {
  items.set(id, await api(`/files/${id}?fields=id,name,mimeType`));
}
if (ROOT_FOLDER_ID) await walk(ROOT_FOLDER_ID);
console.log(`Đã quét ${items.size} mục.\n`);

// Thư mục gốc vẫn nằm trong thư mục cha thuộc Drive của tài khoản cũ, nên quyền của
// tài khoản cũ được kế thừa xuống cả cây và không xoá được trên từng file.
// Cắt kế thừa ở thư mục gốc (Drive "limited access"); quyền gán trực tiếp
// như service account không bị ảnh hưởng.
if (ROOT_FOLDER_ID) {
  const { permissions = [] } = await api(
    `/files/${ROOT_FOLDER_ID}/permissions?fields=permissions(emailAddress,permissionDetails)`
  );
  const inheritedFromParent = permissions.some(p =>
    (p.emailAddress || "").toLowerCase() === TARGET_EMAIL &&
    p.permissionDetails?.every(d => d.inherited)
  );
  if (inheritedFromParent) {
    if (APPLY) {
      await api(`/files/${ROOT_FOLDER_ID}?fields=inheritedPermissionsDisabled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inheritedPermissionsDisabled: true }),
      });
      console.log("✅ Đã cắt quyền kế thừa từ thư mục cha ở thư mục gốc.\n");
    } else {
      console.log("   sẽ cắt quyền kế thừa từ thư mục cha ở thư mục gốc\n");
    }
  }
}

// Kiểm tra quyền từng mục và thu hồi
let found = 0, revoked = 0, skipped = 0, inherited = 0;
const failures = [];
const queue = [...items.values()];

async function worker() {
  while (queue.length) {
    const f = queue.shift();
    try {
      const { permissions = [] } = await api(
        `/files/${f.id}/permissions?fields=permissions(id,emailAddress,role,type,permissionDetails)`
      );
      const perm = permissions.find(p => (p.emailAddress || "").toLowerCase() === TARGET_EMAIL);
      if (!perm) continue;
      found++;
      // Quyền chỉ kế thừa sẽ mất theo thư mục cha, không xoá riêng được
      if (perm.permissionDetails?.every(d => d.inherited)) {
        inherited++;
        continue;
      }
      if (perm.role === "owner") {
        skipped++;
        console.warn(`⚠️  Bỏ qua (vẫn là owner): ${f.name} [${f.id}]`);
        continue;
      }
      if (!APPLY) {
        console.log(`   sẽ thu hồi ${perm.role.padEnd(9)} ${f.name}`);
        continue;
      }
      await api(`/files/${f.id}/permissions/${perm.id}`, { method: "DELETE" });
      revoked++;
      if (revoked % 50 === 0) console.log(`   ...đã thu hồi ${revoked}`);
    } catch (e) {
      failures.push({ f, message: e.message });
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

console.log(`\nTìm thấy quyền của ${TARGET_EMAIL} trên ${found} mục.`);
if (APPLY) console.log(`✅ Đã thu hồi: ${revoked}`);
if (inherited) console.log(`ℹ️  Quyền kế thừa từ thư mục cha (mất khi cắt kế thừa, chạy lại để kiểm tra): ${inherited}`);
if (skipped) console.log(`⚠️  Bỏ qua vì là owner: ${skipped}`);
if (failures.length) {
  console.log(`❌ Lỗi: ${failures.length}`);
  for (const { f, message } of failures) console.log(`   ${f.name} [${f.id}]: ${message}`);
}
if (!APPLY && found) console.log("\nChạy lại với --apply để thu hồi thật.");
