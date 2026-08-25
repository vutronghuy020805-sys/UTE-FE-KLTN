export const dynamic = 'force-dynamic';

import { Card } from "@/components/ui/index";
import { BcttSettingsForm } from "./bctt-settings-form";
import { DeadlineSettingsForm } from "./deadline-settings-form";
import { Settings } from "lucide-react";
import { db } from "@/lib/sheets/client";

export default async function DeanSettingsPage() {
  const activeTerm = await db.terms.getActive();

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-500" />
        <h1 className="text-lg font-bold text-slate-900">Cài đặt hệ thống</h1>
      </div>

      <Card title="Hạn nộp học kỳ hiện tại" description="Cập nhật hạn nộp KLTN và BCTT cho học kỳ đang active">
        <DeadlineSettingsForm
          currentKltnDeadline={activeTerm?.kltn_deadline ?? null}
          currentBcttDeadline={activeTerm?.bctt_deadline ?? null}
        />
      </Card>

      <Card title="Xử lý BCTT hàng loạt" description="Duyệt hoặc pass tất cả đề tài BCTT đủ điều kiện ngay lập tức">
        <BcttSettingsForm />
      </Card>
    </div>
  );
}
