import type { Dispatch, SetStateAction } from "react";

import { formatDateTime, formatMoneyFromCents, roleLabel, statusLabel } from "@/lib/format";
import type { OperationRecord, PagedResult } from "@/types/api";

import type { OperationFilters } from "../types";
import { Badge, EmptyState, PanelHeader } from "../components/ui";

export function OperationLogsPanel({
  records,
  filters,
  setFilters,
  onSearch,
}: {
  records?: PagedResult<OperationRecord>;
  filters: OperationFilters;
  setFilters: Dispatch<SetStateAction<OperationFilters>>;
  onSearch: () => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="操作记录"
        description="基于现有业务表聚合出来的记录。没有新增审计表，所以部分内容是业务记录，不是完整前后快照。"
        action={
          <div className="grid grid-cols-[180px_150px_170px_auto] gap-2">
            <input
              className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
              placeholder="人名/电话/对象"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            />
            <select
              className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
              value={filters.role}
              onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="">全部角色</option>
              <option value="Admin">管理员</option>
              <option value="Ops">运营</option>
              <option value="Counselor">咨询师</option>
              <option value="Patient">来访者</option>
            </select>
            <select
              className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
              value={filters.actionType}
              onChange={(event) => setFilters((prev) => ({ ...prev, actionType: event.target.value }))}
            >
              <option value="">全部操作</option>
              <option value="REFUND_EXEMPTION">豁免审核</option>
              <option value="ORDER">订单</option>
              <option value="CONSULTATION">预约</option>
              <option value="CASE_RECORD">咨询记录</option>
              <option value="LEAVE_REQUEST">请假</option>
              <option value="CONTENT">内容</option>
              <option value="ROLE_SWITCH">角色切换</option>
            </select>
            <button
              className="rounded-xl bg-[var(--lxxl-green)] px-4 py-2 text-sm font-medium text-white"
              type="button"
              onClick={onSearch}
            >
              查询
            </button>
          </div>
        }
      />
      {!records || records.items.length === 0 ? (
        <EmptyState text="暂无操作/业务记录。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 font-medium">类型</th>
              <th className="px-5 py-3 font-medium">操作人</th>
              <th className="px-5 py-3 font-medium">对象</th>
              <th className="px-5 py-3 font-medium">金额</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">摘要</th>
            </tr>
          </thead>
          <tbody>
            {records.items.map((record) => (
              <tr key={record.id} className="border-t border-[var(--lxxl-border)] align-top">
                <td className="px-5 py-4">{formatDateTime(record.occurredAt)}</td>
                <td className="px-5 py-4">{record.actionLabel}</td>
                <td className="px-5 py-4">
                  <div className="font-medium">{record.operatorName || "-"}</div>
                  <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                    {record.operatorContact || roleLabel(record.operatorRole)}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {record.targetName || record.counselorName || `${record.targetType || "-"}#${record.targetId || "-"}`}
                </td>
                <td className="px-5 py-4">{record.amount == null ? "-" : formatMoneyFromCents(record.amount)}</td>
                <td className="px-5 py-4">
                  <Badge>{statusLabel(record.status)}</Badge>
                </td>
                <td className="max-w-sm px-5 py-4 text-[var(--lxxl-muted)]">{record.summary || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
