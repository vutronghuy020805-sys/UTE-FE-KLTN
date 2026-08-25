"use client";

import { Card, Table, Thead, Tbody, Th, Td, Tr } from "@/components/ui/index";
import { Download } from "lucide-react";

export interface CommitteeRow {
  committeeId: string;
  committeeName: string;
  chairName: string;
  secretaryName: string;
  defenseDate: string;
  studentCount: number;
}

interface Props {
  rows: CommitteeRow[];
}

export function CommitteeExportTable({ rows }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Hội đồng ({rows.length})
        </h2>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-slate-400 py-6">Chưa có hội đồng nào</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Hội đồng</Th>
                <Th>Chủ tịch</Th>
                <Th>Thư ký</Th>
                <Th>Ngày bảo vệ</Th>
                <Th>Số SV</Th>
                <Th>Tải biên bản</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.committeeId}>
                  <Td><p className="font-medium text-slate-800">{r.committeeName}</p></Td>
                  <Td><span className="text-sm text-slate-600">{r.chairName}</span></Td>
                  <Td><span className="text-sm text-slate-600">{r.secretaryName}</span></Td>
                  <Td><span className="text-xs text-slate-500">{r.defenseDate}</span></Td>
                  <Td><span className="font-semibold text-slate-700">{r.studentCount}</span></Td>
                  <Td>
                    <a
                      href={`/api/download/hoi-dong-zip/${r.committeeId}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors w-fit"
                      title="ZIP gồm Excel điểm + BB GVHD + BB GVPB + BB Hội đồng"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải ZIP hội đồng
                    </a>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
