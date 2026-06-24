import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { RefundExemption } from "@/types/api";

import { Badge, EmptyState, Pagination, PanelHeader, TableActionButton } from "@/components/ui";

export function RefundsPanel({
  refunds,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApprove,
  onReject,
}: {
  refunds?: RefundExemption[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const total = refunds?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visibleRefunds = refunds?.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="豁免审核" description="来访取消不满足常规退款条件时，由管理员或运营审核豁免。" />
      {!visibleRefunds || visibleRefunds.length === 0 ? (
        <EmptyState text="暂无豁免申请。" />
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">提交时间</th>
                <th className="px-5 py-3 font-medium">来访者</th>
                <th className="px-5 py-3 font-medium">咨询师</th>
                <th className="px-5 py-3 font-medium">咨询时间</th>
                <th className="px-5 py-3 font-medium">金额</th>
                <th className="px-5 py-3 font-medium">原因</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRefunds.map((item) => (
                <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="px-5 py-4">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="font-medium">{item.patientName}</div>
                    <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.patientMobile || "-"}</div>
                  </td>
                  <td className="px-5 py-4">{item.counselorName}</td>
                  <td className="px-5 py-4">{formatDateTime(item.consultationStartTime)}</td>
                  <td className="px-5 py-4">{formatMoneyFromCents(item.amount)}</td>
                  <td className="max-w-xs px-5 py-4">{item.reason}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.status === "PENDING" ? "gold" : item.status === "APPROVED" ? "green" : "red"}>
                      {statusLabel(item.status)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {item.status === "PENDING" ? (
                      <div className="flex gap-3">
                        <TableActionButton tone="danger" onClick={() => onReject(item.id)}>
                          拒绝
                        </TableActionButton>
                        <TableActionButton onClick={() => onApprove(item.id)}>
                          通过
                        </TableActionButton>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--lxxl-muted)]">已处理</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </section>
  );
}
