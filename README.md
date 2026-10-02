# Hệ thống Quản lý KLTN

Ứng dụng Next.js quản lý khóa luận tốt nghiệp. Dữ liệu lưu trên Google Sheets, file nộp lưu trên Google Drive, đăng nhập bằng Google, email thông báo gửi qua Gmail SMTP. Ứng dụng được deploy trên Vercel.

## Tài khoản và dịch vụ

| Thành phần | Giá trị |
|---|---|
| Tài khoản Google chủ dữ liệu và gửi email | `cdsqlkltn@hcmute.edu.vn` |
| Google Sheet dữ liệu | `KLTN_Data` (`GOOGLE_SHEET_ID`) |
| Thư mục Drive gốc | `UTE-FE-KLTN-App` (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) |
| Service account (ứng dụng dùng để đọc/ghi Sheet và Drive) | `fe-kltn-prod@ute-fe-kltn-prod.iam.gserviceaccount.com` |
| Google Cloud project | `ute-fe-kltn-prod` |
| Vercel project | `ute-fe-kltn` |

Service account phải giữ quyền **Editor** trên Sheet và thư mục Drive gốc. Gỡ quyền này thì ứng dụng ngừng hoạt động.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị, xem mục Biến môi trường
npm run dev                  # http://localhost:3000
```

## Biến môi trường

Giá trị thật **không** nằm trong repo. Chúng được bàn giao riêng và đã được cấu hình trên Vercel (Project Settings → Environment Variables). Không commit `.env.local`.

| Biến | Ý nghĩa |
|---|---|
| `NEXTAUTH_URL` | URL của ứng dụng (`http://localhost:3000` khi chạy trên máy) |
| `NEXTAUTH_SECRET` | Chuỗi ngẫu nhiên dùng để ký phiên đăng nhập |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client cho đăng nhập bằng Google |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Service account đọc/ghi Sheet và Drive |
| `GOOGLE_SHEET_ID` | ID của Sheet `KLTN_Data` |
| `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID thư mục Drive gốc |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth của tài khoản chủ Drive, dùng để upload file |
| `NEXT_PUBLIC_APP_NAME` | Tên hiển thị của ứng dụng |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME` | Gmail SMTP. `SMTP_PASS` là App Password của Gmail, không phải mật khẩu đăng nhập |
| `CRON_SECRET` | Bảo vệ các endpoint cron |

Sau khi đổi biến trên Vercel thì phải **redeploy** để biến mới có hiệu lực.

## Tác vụ định kỳ

| Tác vụ | Lịch chạy | Cấu hình |
|---|---|---|
| `/api/cron/deadline-reminder`: nhắc hạn nộp | Hằng ngày lúc 00:00 UTC | [vercel.json](vercel.json) |
| `/api/cron/bctt-auto`: tự động xử lý BCTT | Mỗi 5 phút | [.github/workflows/bctt-auto.yml](.github/workflows/bctt-auto.yml), cần 2 GitHub secret `APP_URL` và `CRON_SECRET` |

Nếu đổi `CRON_SECRET` thì phải cập nhật ở cả Vercel và GitHub secret.

## Script

| Lệnh | Công dụng |
|---|---|
| `node scripts/get-drive-token.mjs` | Lấy lại `GOOGLE_DRIVE_REFRESH_TOKEN` (đăng nhập bằng `cdsqlkltn@hcmute.edu.vn`). Chạy khi upload file báo lỗi `invalid_grant` |
| `npx ts-node scripts/setup-sheets.ts` | Khởi tạo các tab và cột của Google Sheet |
| `npx ts-node scripts/seed.ts` | Điền dữ liệu mẫu vào Sheet |
| `node scripts/create-root-folder.mjs` | Tạo thư mục Drive gốc mới |
| `npx ts-node scripts/cleanup-old-score-notifications.ts` | Xoá các thông báo cũ có lộ điểm thành phần |
| `node scripts/revoke-old-account-access.mjs [--apply]` | Thu hồi quyền của tài khoản cũ trên Sheet và Drive. Không có `--apply` thì chỉ chạy thử |
| `scripts/push-env-to-vercel.ps1` | Đẩy toàn bộ biến trong `.env.local` lên Vercel (cần Vercel CLI đã đăng nhập và đã link project) |
