import type { Dispatch, FormEvent, SetStateAction } from "react";

import { formatDateTime, formatMoneyFromCents, roleLabel, statusLabel } from "@/lib/format";
import type { OperationRecord, PagedResult } from "@/types/api";

import type { OperationFilters } from "@/types/app";
import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";

export function OperationLogsPanel({
  records,
  listLoading,
  filters,
  setFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
}: {
  records?: PagedResult<OperationRecord>;
  listLoading: boolean;
  filters: OperationFilters;
  setFilters: Dispatch<SetStateAction<OperationFilters>>;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--lxxl-border)] bg-white">
      <form className="px-6 py-5 sm:px-7 lg:px-8" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold tracking-normal">操作记录</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            基于现有业务表聚合出来的记录。没有新增审计表，所以部分内容是业务记录，不是完整前后快照。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="关键词">
            <input
              className={queryControlClass}
              placeholder="人名/电话/对象"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            />
          </QueryField>
          <QueryField label="角色">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={filters.role}
              onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="">全部角色</option>
              <option value="Admin">管理员</option>
              <option value="Ops">运营</option>
              <option value="Counselor">咨询师</option>
              <option value="Patient">来访者</option>
            </select>
          </QueryField>
          <QueryField label="操作类型">
            <select
              className={`${queryControlClass} appearance-auto`}
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
          </QueryField>
          <QueryField label="操作人 ID">
            <input
              className={queryControlClass}
              inputMode="numeric"
              placeholder="操作人ID"
              value={filters.operatorId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, operatorId: event.target.value.replace(/\D/g, "") }))
              }
            />
          </QueryField>
          <QueryField label="开始日期">
            <input
              className={queryControlClass}
              type="date"
              value={filters.startAt}
              onChange={(event) => setFilters((prev) => ({ ...prev, startAt: event.target.value }))}
            />
          </QueryField>
          <QueryField label="结束日期">
            <input
              className={queryControlClass}
              type="date"
              value={filters.endAt}
              onChange={(event) => setFilters((prev) => ({ ...prev, endAt: event.target.value }))}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="relative">
        {listLoading && records && records.items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!records || records.items.length === 0 ? (
        <EmptyState text={listLoading ? "正在加载列表..." : "暂无操作/业务记录。"} />
      ) : (
        <>
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
          <Pagination
            page={records.page}
            pageSize={records.pageSize}
            total={records.total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
      </div>
    </section>
  );
}
