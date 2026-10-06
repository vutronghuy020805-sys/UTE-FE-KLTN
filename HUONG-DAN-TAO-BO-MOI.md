# Hướng dẫn tạo một bộ hệ thống mới, độc lập

Tài liệu này dùng khi một đơn vị mới cần **một bộ hệ thống riêng**, chạy bằng **email Google riêng**, không dùng chung dữ liệu, tài khoản hay khóa nào với bộ đang chạy.

> Đây **không** phải hướng dẫn chuyển chủ sở hữu bộ hiện tại sang email khác. Bộ hiện tại cứ giữ nguyên.

---

## 0. Một "bộ" gồm những gì

| # | Thành phần | Dùng để làm gì | Bộ mới phải |
|---|---|---|---|
| 1 | Mã nguồn (repo GitHub) | Code ứng dụng | **Sao chép** từ bộ cũ |
| 2 | Google Cloud project | Chứa service account và OAuth client | **Tạo mới** bằng email mới |
| 3 | Google Sheet dữ liệu | Toàn bộ dữ liệu (người dùng, đề tài, điểm…) | **Copy cấu trúc** từ bộ cũ, xóa dữ liệu |
| 4 | Thư mục Google Drive gốc | Chứa file sinh viên, giảng viên nộp | **Tạo mới** bằng email mới |
| 5 | Gmail gửi email | Gửi email nhắc hạn, thông báo | **Tạo App Password** cho email mới |
| 6 | Vercel project | Nơi ứng dụng chạy, có URL riêng | **Tạo mới** |
| 7 | GitHub Actions | Chạy tự động xử lý BCTT mỗi 5 phút | Cấu hình secret trong repo mới |

### Lấy gì từ bộ cũ

- **Mã nguồn**: repo GitHub https://github.com/vutronghuy020805-sys/UTE-FE-KLTN (công khai, ai cũng tải được). Cách tải xem **mục 5.1**.
- **Cấu trúc Google Sheet `KLTN_Data`**: tên các tab, hàng tiêu đề, và các tab cấu hình (tiêu chí chấm điểm, lĩnh vực, cài đặt).
- **Các mẫu biên bản**: đã nằm sẵn trong code, thư mục `public/templates/`.

### Không lấy gì từ bộ cũ

- **Không** copy file `.env.local` của bộ cũ. Mọi giá trị trong đó đều tạo lại cho bộ mới.
- **Không** dùng lại service account `fe-kltn-prod@...`, Google Cloud project `ute-fe-kltn-prod`, hay Vercel project `ute-fe-kltn`.
- **Không** copy thư mục Drive và các file đã nộp.
- **Không** giữ dữ liệu sinh viên, đề tài, điểm của bộ cũ trong Sheet mới.

### Cần chuẩn bị trước

- [ ] Email Google mới của đơn vị (gọi tắt là **EMAIL_MỚI**), đã bật **Xác minh 2 bước** (cần cho App Password ở bước 4).
- [ ] Quyền **xem** Google Sheet `KLTN_Data` của bộ cũ (nhờ người đang giữ `cdsqlkltn@hcmute.edu.vn` chia sẻ quyền Viewer cho EMAIL_MỚI).
- [ ] Một tài khoản GitHub và một tài khoản Vercel cho đơn vị mới.
- [ ] Máy tính có Node.js 20 trở lên và Git.

Trong lúc làm, ghi các giá trị lấy được vào **bảng ở mục 10** để không bị thất lạc.

---

## 1. Tạo Google Cloud project

Toàn bộ bước này làm khi **đăng nhập bằng EMAIL_MỚI** tại https://console.cloud.google.com.

### 1.1. Tạo project và bật API

1. Chọn project ở thanh trên cùng → **New Project**. Đặt tên, ví dụ `kltn-<tên-đơn-vị>` → **Create**. Chọn project vừa tạo.
2. Vào **APIs & Services → Library**, bật 2 API:
   - **Google Sheets API**
   - **Google Drive API**

### 1.2. Cấu hình màn hình đồng ý OAuth

1. **APIs & Services → OAuth consent screen** (hoặc **Google Auth Platform → Branding**).
2. Loại người dùng (**Audience**):
   - Nếu EMAIL_MỚI và tất cả người dùng cùng một tổ chức Google Workspace (ví dụ cùng `@hcmute.edu.vn`): chọn **Internal**.
   - Nếu người dùng dùng nhiều tên miền khác nhau (ví dụ sinh viên dùng `@gmail.com`): chọn **External**, rồi bấm **Publish app** để chuyển sang trạng thái **In production**.

   > **Quan trọng:** nếu để External ở trạng thái **Testing**, refresh token của Drive sẽ hết hạn sau 7 ngày và upload file sẽ hỏng (lỗi `invalid_grant`).
3. Điền tên ứng dụng và email hỗ trợ (EMAIL_MỚI) → lưu.

### 1.3. Tạo OAuth client cho đăng nhập (loại Web)

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Đặt tên, ví dụ `kltn-login`.
3. **Authorized redirect URIs**, thêm:
   - `http://localhost:3000/api/auth/callback/google`
   - URL thật sẽ thêm ở bước 7, sau khi có domain Vercel.
4. **Create**. Ghi lại:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client secret → `GOOGLE_CLIENT_SECRET`

### 1.4. Tạo OAuth client cho upload Drive (loại Desktop)

1. **Create credentials → OAuth client ID**, Application type: **Desktop app**. Đặt tên, ví dụ `kltn-drive`.
2. **Create**. Ghi lại:
   - Client ID → `GOOGLE_DRIVE_CLIENT_ID`
   - Client secret → `GOOGLE_DRIVE_CLIENT_SECRET`

> Vì sao cần client riêng cho Drive: service account không có dung lượng lưu trữ Drive. Ứng dụng upload file bằng chính tài khoản EMAIL_MỚI (qua refresh token), nên file nằm trong dung lượng của EMAIL_MỚI.

### 1.5. Tạo service account

1. **IAM & Admin → Service Accounts → Create service account**. Đặt tên, ví dụ `kltn-app` → **Create and continue** → bỏ qua phần phân quyền → **Done**.
2. Bấm vào service account vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải file về.
3. Mở file JSON, ghi lại:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` (dạng `kltn-app@<project>.iam.gserviceaccount.com`)
   - `private_key` → `GOOGLE_PRIVATE_KEY`

> Giữ file JSON này như mật khẩu. Không gửi qua chat công khai, không commit vào Git.
>
> Nếu tổ chức chặn tạo key (lỗi `iam.disableServiceAccountKeyCreation`), cần nhờ quản trị Google Cloud của tổ chức tắt chính sách này cho project.

---

## 2. Tạo Google Sheet dữ liệu

Không dùng `scripts/setup-sheets.ts` cho việc này: script đó đã cũ, thiếu nhiều tab ứng dụng đang dùng (`committees`, `settings`, `drive_folders`, `Field`, các tab tiêu chí `BB …`). Cách đúng là **copy Sheet của bộ cũ rồi xóa dữ liệu**.

### 2.1. Copy Sheet

1. Đăng nhập EMAIL_MỚI, mở Sheet `KLTN_Data` của bộ cũ.
2. **File → Make a copy** (Tệp → Tạo bản sao). Đặt tên, ví dụ `KLTN_Data_<tên-đơn-vị>`. Để bản sao trong **My Drive của EMAIL_MỚI**.
3. Mở bản sao. Từ đây trở đi **chỉ làm việc trên bản sao**. Kiểm tra lại tên file trên thanh tiêu đề trước khi xóa bất cứ thứ gì.

### 2.2. Giữ nguyên các tab cấu hình

Không xóa dữ liệu trong các tab sau. Đây là cấu hình dùng chung, không phải dữ liệu của sinh viên:

| Tab | Nội dung |
|---|---|
| `BB GVHD - Đề tài ứng dụng` | Tiêu chí chấm của GVHD |
| `BB GVHD - Đề tài NC` | Tiêu chí chấm của GVHD |
| `BB GVPB - Đề tài ứng dụng` | Tiêu chí chấm của GVPB |
| `BB GVPB - Đề tài NC` | Tiêu chí chấm của GVPB |
| `BB HĐ` | Tiêu chí chấm của Hội đồng |
| `Field` | Danh sách lĩnh vực đề tài |
| `settings` | Cài đặt hạn nộp, BCTT. Giữ lại, rồi chỉnh trong ứng dụng ở bước 9 |

Nếu đơn vị mới có tiêu chí chấm hoặc lĩnh vực khác, sửa trực tiếp trong các tab này, **giữ nguyên hàng tiêu đề (hàng 1)**.

### 2.3. Xóa dữ liệu ở các tab còn lại

Với **mỗi tab không có trong bảng ở 2.2**, xóa từ **hàng 2 trở xuống**, **giữ lại hàng 1** (tiêu đề cột):

- Bấm vào số hàng `2`, nhấn `Ctrl + Shift + ↓` để chọn đến cuối, chuột phải → **Delete rows** (Xóa hàng).

Danh sách các tab cần xóa dữ liệu:

`users`, `lecturer_quotas`, `topics`, `topic_status_histories`, `files`, `files_dang_ky`, `files_bao_cao`, `files_khoa_luan`, `files_turnitin`, `files_bai_bao`, `files_chinh_sua`, `files_bien_ban`, `files_giai_trinh`, `files_xac_nhan`, `files_nhan_xet`, `files_khac`, `committees`, `committee_assignments`, `scores`, `revisions`, `notifications`, `audit_logs`, `academic_terms`, `drive_folders`, `reviewer_preassignments`, `deadline_reminders`.

Nếu Sheet có tab nào khác không nằm trong cả hai danh sách, mở ra xem: nếu chứa dữ liệu của bộ cũ thì xóa dữ liệu, giữ tiêu đề.

### 2.4. Thêm tài khoản Admin đầu tiên

Ứng dụng chỉ cho đăng nhập những email **có trong tab `users`**. Vào tab `users`, ở hàng 2 điền theo đúng tên cột ở hàng 1:

| Cột | Giá trị |
|---|---|
| `id` | `admin-1` |
| `email` | Email của người quản trị (có thể là EMAIL_MỚI) |
| `full_name` | Họ tên |
| `system_role` | `ADMIN` |
| `is_active` | `TRUE` |
| `created_at`, `updated_at` | Có thể để trống |

Các cột khác để trống. Người dùng còn lại (trưởng khoa, giảng viên, sinh viên) thêm sau trong ứng dụng.

Giá trị `system_role` hợp lệ: `ADMIN`, `DEAN`, `LECTURER`, `STUDENT`.

### 2.5. Chia sẻ Sheet cho service account

1. Bấm **Share** (Chia sẻ), dán `GOOGLE_SERVICE_ACCOUNT_EMAIL`, chọn quyền **Editor**, bỏ chọn "Notify people" → **Share**.
2. Lấy ID Sheet từ URL: `https://docs.google.com/spreadsheets/d/`**`<ID>`**`/edit` → `GOOGLE_SHEET_ID`.

---

## 3. Tạo thư mục Drive gốc

1. Đăng nhập EMAIL_MỚI tại https://drive.google.com.
2. Trong **My Drive** (không phải trong thư mục người khác chia sẻ), tạo thư mục mới, ví dụ `KLTN-<tên-đơn-vị>-App`.

   > Phải tạo thẳng trong My Drive của EMAIL_MỚI. Nếu đặt bên trong thư mục của tài khoản khác, tài khoản đó sẽ tự động có quyền trên toàn bộ file. Bộ hiện tại đã gặp đúng vấn đề này với tài khoản cũ.
3. Chuột phải thư mục → **Share** → thêm `GOOGLE_SERVICE_ACCOUNT_EMAIL` với quyền **Editor**.
4. Lấy ID thư mục từ URL: `https://drive.google.com/drive/folders/`**`<ID>`** → dùng cho **cả hai** biến `GOOGLE_DRIVE_FOLDER_ID` và `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

---

## 4. Tạo App Password Gmail để gửi email

1. Đăng nhập EMAIL_MỚI tại https://myaccount.google.com → **Security** (Bảo mật).
2. Bảo đảm **2-Step Verification** (Xác minh 2 bước) đang bật.
3. Vào https://myaccount.google.com/apppasswords, đặt tên ví dụ `kltn-smtp` → **Create**.
4. Ghi lại mật khẩu 16 ký tự, **bỏ hết dấu cách** → `SMTP_PASS`. `SMTP_USER` = EMAIL_MỚI.

> Nếu không thấy mục App passwords: tổ chức Google Workspace đã tắt tính năng này. Nhờ quản trị IT của tổ chức bật cho EMAIL_MỚI.

---

## 5. Sao chép mã nguồn

### 5.1. Tạo repo mới

```bash
git clone https://github.com/vutronghuy020805-sys/UTE-FE-KLTN.git KLTN-<ten-don-vi>
cd KLTN-<ten-don-vi>
```

Trên GitHub của đơn vị mới, tạo một repo **trống** (không tạo README), ví dụ `KLTN-<ten-don-vi>`, chọn **Private**. Rồi trỏ code sang repo đó:

```bash
git remote set-url origin https://github.com/<tai-khoan-moi>/KLTN-<ten-don-vi>.git
git push -u origin main
```

Từ đây bộ mới có lịch sử code riêng, sửa gì cũng không ảnh hưởng bộ cũ.

### 5.2. Sửa các chỗ ghi riêng cho đơn vị

| Chỗ cần sửa | Hiện đang là | Sửa thành |
|---|---|---|
| [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx), 2 chỗ chữ `Khoa Kinh tế` | Khoa Kinh tế | Tên đơn vị mới |
| [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx), thẻ `<img src=...>` | Logo ĐH SPKT TP.HCM (link Wikimedia) | Logo đơn vị mới, nếu khác |
| [public/logo.png](public/logo.png), [public/bg-login.jpg](public/bg-login.jpg) | Logo và ảnh nền hiện tại | Ảnh của đơn vị mới, nếu khác |
| [public/templates/](public/templates/) | Mẫu biên bản, phiếu chấm, bảng điểm | Mở bằng Word/Excel, sửa tên đơn vị nếu có. **Không sửa các thẻ `{...}`** trong mẫu |
| [scripts/get-drive-token.mjs](scripts/get-drive-token.mjs), dòng ghi `cdsqlkltn@hcmute.edu.vn` | Email bộ cũ | EMAIL_MỚI (chỉ là dòng hướng dẫn in ra màn hình) |
| [README.md](README.md), bảng "Tài khoản và dịch vụ" | Thông tin bộ cũ | Thông tin bộ mới |

Sửa xong thì commit:

```bash
git add .
git commit -m "Cau hinh cho don vi <ten-don-vi>"
git push
```

---

## 6. Tạo file `.env.local` và chạy thử trên máy

### 6.1. Tạo file

```bash
npm install
cp .env.example .env.local
```

Mở `.env.local` và điền:

| Biến | Lấy từ đâu |
|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` (giữ nguyên khi chạy trên máy) |
| `NEXTAUTH_SECRET` | Chuỗi ngẫu nhiên mới, tạo bằng lệnh ở dưới |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Bước 1.3 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Bước 1.5, `client_email` |
| `GOOGLE_PRIVATE_KEY` | Bước 1.5, `private_key`. Dán nguyên văn, **đặt trong dấu ngoặc kép**, giữ các ký tự `\n`. Ví dụ: `GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"` |
| `GOOGLE_SHEET_ID` | Bước 2.5 |
| `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Bước 3, cùng một ID |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` | Bước 1.4 |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Bước 6.2 ngay dưới đây |
| `NEXT_PUBLIC_APP_NAME` | Tên hiển thị của ứng dụng |
| `SMTP_HOST`, `SMTP_PORT` | Giữ `smtp.gmail.com` và `587` |
| `SMTP_USER`, `SMTP_PASS` | Bước 4 |
| `SMTP_FROM_NAME` | Tên người gửi hiển thị trong email |
| `CRON_SECRET` | Chuỗi ngẫu nhiên mới, tạo bằng lệnh ở dưới |

Tạo chuỗi ngẫu nhiên (chạy 2 lần, một cho `NEXTAUTH_SECRET`, một cho `CRON_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6.2. Lấy refresh token Drive

```bash
node scripts/get-drive-token.mjs
```

1. Mở link script in ra, **đăng nhập bằng EMAIL_MỚI**, cho phép quyền Drive.
2. Nếu Google báo "Google hasn't verified this app": bấm **Advanced → Go to … (unsafe)**. Đây là ứng dụng của chính đơn vị nên an toàn.
3. Script in ra dòng `GOOGLE_DRIVE_REFRESH_TOKEN=...` → dán vào `.env.local`.

### 6.3. Chạy thử

```bash
npm run dev
```

Mở http://localhost:3000, đăng nhập bằng email Admin đã thêm ở bước 2.4. Nếu vào được trang quản trị là Sheet, service account và OAuth đăng nhập đã đúng.

---

## 7. Đưa lên Vercel

Đăng nhập Vercel bằng tài khoản của đơn vị mới.

```bash
npm install -g vercel
vercel login
vercel link
```

Khi `vercel link` hỏi:
- "Link to existing project?" → chọn **No** (tạo project mới). **Không** chọn `ute-fe-kltn` của bộ cũ.
- Đặt tên project, ví dụ `kltn-<ten-don-vi>`.

### 7.1. Đẩy biến môi trường

```powershell
.\scripts\push-env-to-vercel.ps1
```

Script đẩy toàn bộ biến trong `.env.local` lên Vercel. Vì `NEXTAUTH_URL` trong `.env.local` là `localhost`, cần sửa riêng biến này cho production ở bước 7.2.

### 7.2. Deploy lần đầu và sửa `NEXTAUTH_URL`

```bash
vercel deploy --prod
```

Ghi lại domain chính thức, dạng `https://kltn-<ten-don-vi>.vercel.app` → **APP_URL**.

Vào Vercel → project → **Settings → Environment Variables**, sửa `NEXTAUTH_URL` (môi trường **Production**) thành APP_URL. Rồi deploy lại để biến mới có hiệu lực:

```bash
vercel deploy --prod
```

### 7.3. Thêm URL thật vào OAuth client

Quay lại Google Cloud → **Credentials** → OAuth client loại Web (bước 1.3) → **Authorized redirect URIs**, thêm:

```
<APP_URL>/api/auth/callback/google
```

Lưu, đợi vài phút rồi thử đăng nhập trên APP_URL.

> Repo này deploy bằng lệnh `vercel deploy`, **không** tự deploy khi push lên GitHub. Mỗi lần sửa code: commit, push, rồi chạy `vercel deploy --prod`.

---

## 8. Bật tác vụ định kỳ

### 8.1. Nhắc hạn nộp hằng ngày

Đã cấu hình sẵn trong [vercel.json](vercel.json), Vercel tự chạy. Chỉ cần `CRON_SECRET` đã có trên Vercel (bước 7.1).

### 8.2. Tự động xử lý BCTT mỗi 5 phút (GitHub Actions)

Trong repo GitHub mới → **Settings → Secrets and variables → Actions → New repository secret**, tạo 2 secret:

| Tên | Giá trị |
|---|---|
| `APP_URL` | APP_URL, không có dấu `/` ở cuối |
| `CRON_SECRET` | Giống hệt `CRON_SECRET` trong `.env.local` |

Kiểm tra: tab **Actions → BCTT Auto Process → Run workflow**. Mở lần chạy đó, phần log phải in ra kết quả JSON, không có chữ `API call failed`.

> Nếu tab Actions báo workflow bị tắt, bấm **Enable workflow**. GitHub cũng tự tắt lịch chạy khi repo không có commit nào trong 60 ngày; khi đó vào bật lại.

---

## 9. Kiểm tra lần cuối

Đăng nhập bằng Admin trên APP_URL và lần lượt thử:

- [ ] Tạo học kỳ / đợt mới và đặt làm học kỳ đang hoạt động.
- [ ] Thêm vài người dùng (trưởng khoa, giảng viên, sinh viên) và đăng nhập thử bằng một tài khoản giảng viên.
- [ ] Kiểm tra trang **Cài đặt** (hạn nộp, BCTT) cho phù hợp đơn vị mới.
- [ ] Sinh viên upload thử một file → file xuất hiện trong thư mục Drive gốc ở bước 3.
- [ ] Gửi thử một email nhắc hạn → email tới nơi, người gửi là EMAIL_MỚI.
- [ ] GitHub Actions chạy thành công (bước 8.2).
- [ ] Mở Sheet và Drive của **bộ cũ**, xác nhận không có dữ liệu mới nào từ bộ mới ghi vào đó.

Xong các mục trên thì bộ mới đã độc lập hoàn toàn. Có thể gỡ quyền xem Sheet bộ cũ của EMAIL_MỚI (đã cấp ở phần Chuẩn bị).

---

## 10. Bảng ghi thông tin bộ mới

Điền và cất bảng này ở nơi an toàn (không đưa mật khẩu, secret vào đây nếu tài liệu được chia sẻ rộng).

| Mục | Giá trị |
|---|---|
| EMAIL_MỚI (chủ dữ liệu, gửi email) | |
| Google Cloud project | |
| Service account email | |
| Tên và link Google Sheet | |
| Tên và link thư mục Drive gốc | |
| Repo GitHub | |
| Vercel project | |
| APP_URL | |
| Người giữ file `.env.local` và key JSON | |
| Ngày tạo bộ | |

---

## 11. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Đăng nhập báo "Email của bạn chưa được đăng ký" | Email chưa có trong tab `users` | Thêm vào `users` (bước 2.4) hoặc qua trang Admin. Chờ tối đa 5 phút vì ứng dụng có cache |
| Đăng nhập báo lỗi Sheet (`SheetError`) | Service account chưa có quyền Editor trên Sheet, hoặc `GOOGLE_SHEET_ID` / `GOOGLE_PRIVATE_KEY` sai | Làm lại bước 2.5, kiểm tra private key có dấu ngoặc kép và `\n` |
| Google báo `redirect_uri_mismatch` | Chưa thêm URL callback vào OAuth client Web | Bước 7.3, URL phải khớp chính xác kể cả `https` |
| Upload file báo `invalid_grant` | Refresh token Drive hết hạn hoặc bị thu hồi | Chạy lại bước 6.2, cập nhật trên Vercel, deploy lại. Nếu lặp lại sau mỗi 7 ngày: OAuth consent screen đang ở Testing (bước 1.2) |
| Upload file báo lỗi 403 / không tìm thấy thư mục | Sai `GOOGLE_DRIVE_ROOT_FOLDER_ID`, hoặc refresh token lấy bằng email khác EMAIL_MỚI | Kiểm tra ID ở bước 3; lấy lại token và nhớ đăng nhập đúng EMAIL_MỚI |
| Gửi email báo lỗi `535` / `Invalid login` | `SMTP_PASS` sai, còn dấu cách, hoặc đang dùng mật khẩu đăng nhập thay vì App Password | Làm lại bước 4 |
| Sửa biến trên Vercel nhưng không có tác dụng | Chưa deploy lại | `vercel deploy --prod` |
| GitHub Actions báo `API call failed` | Sai `APP_URL` hoặc `CRON_SECRET` lệch giữa GitHub và Vercel | Kiểm tra lại bước 8.2 |
