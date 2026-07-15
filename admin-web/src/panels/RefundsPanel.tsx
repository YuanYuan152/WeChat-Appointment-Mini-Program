import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { RefundExemption } from "@/types/api";
import { useEffect, useState } from "react";

import {
  Badge,
  EmptyState,
  Pagination,
  PanelHeader,
  QueryButton,
  QueryField,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

export function RefundsPanel({
  refunds,
  page,
  pageSize,
  listLoading,
  onPageChange,
  onPageSizeChange,
  status,
  focusedRefundId,
  setStatus,
  onSearch,
  onApprove,
  onReject,
}: {
  refunds?: RefundExemption[];
  page: number;
  pageSize: number;
  listLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  status: string;
  focusedRefundId?: number | null;
  setStatus: (status: string) => void;
  onSearch: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
}) {
  const [rejectTarget, setRejectTarget] = useState<RefundExemption | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const total = refunds?.length ?? 0;
  const pendingCount = refunds?.filter((item) => item.status === "PENDING").length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visibleRefunds = refunds?.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (!focusedRefundId || !refunds?.length) {
      return;
    }
    const targetIndex = refunds.findIndex((item) => item.id === focusedRefundId);
    if (targetIndex < 0) {
      return;
    }
    const targetPage = Math.floor(targetIndex / pageSize) + 1;
    if (targetPage !== currentPage) {
      onPageChange(targetPage);
    }
  }, [currentPage, focusedRefundId, onPageChange, pageSize, refunds]);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="用户豁免"
        description="来访取消不满足常规退款条件时，由管理员或运营审核豁免。"
        action={
          pendingCount > 0 ? (
            <span className="rounded-full bg-[#FBE8E6] px-3 py-1 text-xs font-medium text-[#A13F37]">
              待处理 {pendingCount}
            </span>
          ) : null
        }
      />
      <form
        className="border-b border-[var(--lxxl-border)] px-6 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="审核状态">
            <select className={queryControlClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">全部</option>
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已拒绝</option>
            </select>
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
        </div>
      </form>
      <div className="relative">
        {listLoading && refunds && refunds.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!visibleRefunds || visibleRefunds.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无豁免申请。"} />
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
                <tr
                  key={item.id}
                  className={`border-t border-[var(--lxxl-border)] align-top ${
                    item.id === focusedRefundId ? "bg-[#FFF9ED]" : ""
                  }`}
                >
                  <td className="px-5 py-4">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="font-medium">
                      {formatPatientNameWithContractTag(item.patientName, item.patientContractTag)}
                    </div>
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
                        <TableActionButton
                          tone="danger"
                          onClick={() => {
                            setRejectTarget(item);
                            setRejectReason("");
                          }}
                        >
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
      </div>
      {rejectTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 py-6">
          <form
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = rejectReason.trim();
              if (!reason) {
                return;
              }
              onReject(rejectTarget.id, reason);
              setRejectTarget(null);
              setRejectReason("");
            }}
          >
            <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
              <h3 className="text-lg font-semibold">填写拒绝原因</h3>
              <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
                {formatPatientNameWithContractTag(rejectTarget.patientName, rejectTarget.patientContractTag)}，
                {formatDateTime(rejectTarget.consultationStartTime)}
              </p>
            </div>
            <div className="px-6 py-5">
              <textarea
                className="min-h-32 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder="请输入拒绝原因"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
              <button
                className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium"
                type="button"
                onClick={() => setRejectTarget(null)}
              >
                取消
              </button>
              <button
                className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                type="submit"
                disabled={!rejectReason.trim()}
              >
                确认拒绝
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
