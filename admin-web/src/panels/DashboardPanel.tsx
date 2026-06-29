import { formatDateTime, formatMoneyFromCents } from "@/lib/format";

import type { ScreenData, SummaryRow } from "@/types/app";
import { Badge, EmptyState, PanelHeader } from "@/components/ui";

export function DashboardPanel({ data, summaryRows }: { data: ScreenData; summaryRows: SummaryRow[] }) {
  const stats = data.dashboard;
  const metrics = [
    { label: "用户数", value: stats?.userCount ?? "-", helper: "AppAccount" },
    { label: "订单数", value: stats?.orderCount ?? "-", helper: `已支付 ${stats?.paidOrderCount ?? "-"}` },
    { label: "已支付金额", value: formatMoneyFromCents(stats?.paidAmount), helper: "PAID 订单合计" },
    { label: "待审核豁免", value: data.refunds?.length ?? "-", helper: "PENDING" },
  ];

  return (
    <div className="grid grid-cols-[1fr_360px] gap-6">
      <div className="min-w-0 space-y-6">
        <section className="grid grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
              <div className="text-sm text-[var(--lxxl-muted)]">{metric.label}</div>
              <div className="mt-3 text-3xl font-semibold">{metric.value}</div>
              <div className="mt-2 text-sm text-[var(--lxxl-green)]">{metric.helper}</div>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
          <PanelHeader title="近期需要关注" description="展示待审核豁免、待补咨询记录和正在占用的咨询室。" />
          {summaryRows.length === 0 ? (
            <EmptyState text="暂无待处理事项。" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">时间</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">相关人员/事项</th>
                  <th className="px-5 py-3 font-medium">金额/咨询师</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={`${row.time}-${row.subject}-${row.type}`} className="border-t border-[var(--lxxl-border)]">
                    <td className="px-5 py-4">{formatDateTime(row.time)}</td>
                    <td className="px-5 py-4">{row.type}</td>
                    <td className="px-5 py-4">{row.subject}</td>
                    <td className="px-5 py-4">{row.amount}</td>
                    <td className="px-5 py-4">
                      <Badge tone="green">{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      <aside className="rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
        <div className="text-sm text-[var(--lxxl-muted)]">咨询记录填写进度</div>
        <h2 className="mt-2 text-lg font-semibold">近 30 天已完成咨询</h2>
        <div className="mt-5 space-y-3">
          {(data.counselorRecords || []).slice(0, 8).map((record) => (
            <div key={record.counselorId} className="rounded-xl bg-[#FAF8F4] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{record.counselorName}</span>
                <Badge tone={record.missingCount > 0 ? "gold" : "green"}>待补记录 {record.missingCount}</Badge>
              </div>
              <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
                已完成咨询 {record.completedCount} 次，已填写记录 {record.recordedCount} 份
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
