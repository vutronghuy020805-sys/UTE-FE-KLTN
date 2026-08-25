/**
 * Cấu hình đường dẫn Google Drive cho hệ thống KLTN.
 *
 * Thay thế các URL placeholder bằng link thực sau khi:
 * 1. Tạo folder trên Google Drive
 * 2. Share folder với quyền "Anyone with link can edit"
 * 3. Copy link vào đây
 */

export interface DriveFolder {
  label: string;
  url: string;
  description?: string;
}

export interface DepartmentDrive {
  name: string;
  code: string;
  bctt: {
    dot1: DriveFolder;
    dot2: DriveFolder;
  };
  kltn: {
    dot1: DriveFolder;
    dot2: DriveFolder;
  };
}

// ============================================================
// CẤU HÌNH DRIVE THEO NGÀNH
// Điền URL thực vào trường url của từng folder
// ============================================================

export const DRIVE_BY_DEPARTMENT: DepartmentDrive[] = [
  {
    name: "Công nghệ thông tin",
    code: "CNTT",
    bctt: {
      dot1: { label: "BCTT – Đợt 1", url: "https://drive.google.com/drive/folders/PLACEHOLDER_CNTT_BCTT_DOT1", description: "Báo cáo thực tập đợt 1" },
      dot2: { label: "BCTT – Đợt 2", url: "https://drive.google.com/drive/folders/PLACEHOLDER_CNTT_BCTT_DOT2", description: "Báo cáo thực tập đợt 2" },
    },
    kltn: {
      dot1: { label: "KLTN – Đợt 1", url: "https://drive.google.com/drive/folders/PLACEHOLDER_CNTT_KLTN_DOT1", description: "Khóa luận tốt nghiệp đợt 1" },
      dot2: { label: "KLTN – Đợt 2", url: "https://drive.google.com/drive/folders/PLACEHOLDER_CNTT_KLTN_DOT2", description: "Khóa luận tốt nghiệp đợt 2" },
    },
  },
  {
    name: "Hệ thống thông tin",
    code: "HTTT",
    bctt: {
      dot1: { label: "BCTT – Đợt 1", url: "https://drive.google.com/drive/folders/PLACEHOLDER_HTTT_BCTT_DOT1", description: "Báo cáo thực tập đợt 1" },
      dot2: { label: "BCTT – Đợt 2", url: "https://drive.google.com/drive/folders/PLACEHOLDER_HTTT_BCTT_DOT2", description: "Báo cáo thực tập đợt 2" },
    },
    kltn: {
      dot1: { label: "KLTN – Đợt 1", url: "https://drive.google.com/drive/folders/PLACEHOLDER_HTTT_KLTN_DOT1", description: "Khóa luận tốt nghiệp đợt 1" },
      dot2: { label: "KLTN – Đợt 2", url: "https://drive.google.com/drive/folders/PLACEHOLDER_HTTT_KLTN_DOT2", description: "Khóa luận tốt nghiệp đợt 2" },
    },
  },
];

// ============================================================
// KIỂM TRA URL ĐÃ CẤU HÌNH CHƯA
// ============================================================

export function isDriveConfigured(url: string): boolean {
  return !url.includes("PLACEHOLDER");
}
