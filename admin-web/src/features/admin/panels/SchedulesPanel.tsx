import { formatDateTime, statusLabel } from "@/lib/format";
import type { ScheduleOverview } from "@/types/api";

import { today } from "../constants";
import { Badge, EmptyState, PanelHeader } from "../components/ui";

export function SchedulesPanel({ schedules }: { schedules?: ScheduleOverview }) {
  const rows = schedules?.counselors.flatMap((counselor) =>
    counselor.schedules.map((schedule) => ({ counselorName: counselor.counselorName, ...schedule })),
  );

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="挂课情况" description={`日期：${schedules?.date || today}。复用运营挂课总览接口。`} />
      {!rows || rows.length === 0 ? (
        <EmptyState text="今天暂无挂课记录。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">咨询师</th>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 font-medium">预约中心</th>
              <th className="px-5 py-3 font-medium">咨询室</th>
              <th className="px-5 py-3 font-medium">来访者</th>
              <th className="px-5 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scheduleId} className="border-t border-[var(--lxxl-border)]">
                <td className="px-5 py-4">{row.counselorName}</td>
                <td className="px-5 py-4">
                  {formatDateTime(row.startTime)} - {formatDateTime(row.endTime)}
                </td>
                <td className="px-5 py-4">{row.centerName || "-"}</td>
                <td className="px-5 py-4">{row.roomName || row.roomId || "-"}</td>
                <td className="px-5 py-4">{row.patientName || "-"}</td>
                <td className="px-5 py-4">
                  <Badge tone="green">{statusLabel(row.status)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
