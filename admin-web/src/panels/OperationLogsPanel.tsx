import type { Dispatch, FormEvent, SetStateAction } from "react";

import { formatDateTime, formatFullDateTime, formatMoneyFromCents, formatUtcFullDateTime, roleLabel, statusLabel } from "@/lib/format";
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

const actionTypeLabels: Record<string, string> = {
  REFUND_EXEMPTION: "退款豁免",
  ORDER: "订单记录",
  CONSULTATION: "预约记录",
  SCHEDULE: "排期记录",
  CASE_RECORD: "咨询记录",
  LEAVE_REQUEST: "请假申请",
  SCHEDULE_CANCEL: "排期取消",
  CONTENT: "内容管理",
  ROLE_SWITCH: "角色切换",
};

const targetTypeLabels: Record<string, string> = {
  Account: "账号",
  Order: "订单",
  Consultation: "咨询预约",
  CaseRecord: "咨询记录",
  RefundExemption: "豁免申请",
  LeaveRequest: "请假申请",
  Schedule: "排期",
  Banner: "Banner",
  Activity: "活动公告",
  Article: "文章",
};

function operationGroupLabel(record: OperationRecord) {
  return actionTypeLabels[record.actionType] || record.actionLabel || "业务记录";
}

function targetTypeLabel(record: OperationRecord) {
  return record.targetType ? targetTypeLabels[record.targetType] || record.targetType : "业务对象";
}

function withContact(name?: string | null, contact?: string | null) {
  if (!name && !contact) {
    return null;
  }
  if (!name) {
    return contact || null;
  }
  return contact ? `${name}（${contact}）` : name;
}

function targetTitle(record: OperationRecord) {
  const type = targetTypeLabel(record);
  if (record.targetType === "Consultation" && record.patientName && record.counselorName) {
    return `预约：${record.patientName} / ${record.counselorName}`;
  }
  if (record.targetType === "CaseRecord" && record.patientName && record.counselorName) {
    return `咨询记录：${record.patientName} / ${record.counselorName}`;
  }
  if (record.targetType === "RefundExemption" && record.patientName) {
    return `豁免申请：${record.patientName}`;
  }
  if (record.targetType === "LeaveRequest" && record.counselorName) {
    return `请假申请：${record.counselorName}`;
  }
  if (record.targetType === "Schedule" && record.counselorName) {
    return `排期：${record.counselorName}`;
  }
  if (record.targetName) {
    return `${type}：${record.targetName}`;
  }
  if (record.patientName && record.counselorName) {
    return `咨询：${record.patientName} / ${record.counselorName}`;
  }
  if (record.patientName) {
    return `来访者：${record.patientName}`;
  }
  if (record.counselorName) {
    return `咨询师：${record.counselorName}`;
  }
  return record.targetId ? `${type} #${record.targetId}` : type;
}

function targetIdText(record: OperationRecord) {
  if (!record.targetId) {
    return null;
  }
  const type = targetTypeLabel(record);
  return `${type} #${record.targetId}`;
}

function operationObjectRows(record: OperationRecord) {
  const rows: Array<{ label: string; value: string }> = [];
  const patient = withContact(record.patientName, record.patientContact);
  const counselor = withContact(record.counselorName, record.counselorContact);
  const targetId = targetIdText(record);

  if (patient) {
    rows.push({ label: "来访者", value: patient });
  }
  if (counselor) {
    rows.push({ label: "咨询师", value: counselor });
  }
  if (targetId) {
    rows.push({ label: "记录编号", value: targetId });
  }
  if (record.relatedOrderId && !(record.targetType === "Order" && record.targetId === record.relatedOrderId)) {
    rows.push({ label: "关联订单", value: `订单 #${record.relatedOrderId}` });
  }
  if (
    record.relatedConsultationId &&
    !(record.targetType === "Consultation" && record.targetId === record.relatedConsultationId)
  ) {
    rows.push({ label: "关联咨询", value: `咨询 #${record.relatedConsultationId}` });
  }
  if (record.scheduleId && !(record.targetType === "Schedule" && record.targetId === record.scheduleId)) {
    rows.push({ label: "关联排期", value: `排期 #${record.scheduleId}` });
  }

  return rows;
}

function relationRows(record: OperationRecord) {
  const rows: Array<{ label: string; value: string }> = [];
  if (record.relatedOrderId) {
    rows.push({ label: "订单", value: `#${record.relatedOrderId}` });
  }
  if (record.relatedConsultationId) {
    rows.push({ label: "咨询", value: `#${record.relatedConsultationId}` });
  }
  if (record.scheduleId && !(record.targetType === "Schedule" && record.targetId === record.scheduleId)) {
    rows.push({ label: "排期", value: `#${record.scheduleId}` });
  }
  return rows;
}

function consultationInfoRows(record: OperationRecord) {
  const rows: Array<{ label: string; value: string }> = [];
  if (record.startTime || record.endTime) {
    rows.push({
      label: "时间",
      value: `${formatFullDateTime(record.startTime)} - ${formatDateTime(record.endTime)}`,
    });
  }
  if (record.centerName || record.roomName) {
    rows.push({
      label: "地点",
      value: [record.centerName, record.roomName].filter(Boolean).join(" / "),
    });
  }
  rows.push(...relationRows(record));
  return rows;
}

function visibleSummary(record: OperationRecord) {
  const summary = record.summary?.trim();
  if (!summary || summary === "-") {
    return null;
  }
  if (record.actionType === "CONSULTATION") {
    return null;
  }
  if (summary.startsWith("center:") || (summary.includes("咨询时间：") && summary.includes("地点："))) {
    return null;
  }
  return summary;
}

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
              <option value="SCHEDULE">排期</option>
              <option value="CASE_RECORD">咨询记录</option>
              <option value="LEAVE_REQUEST">请假</option>
              <option value="SCHEDULE_CANCEL">咨询师取消</option>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">时间</th>
                  <th className="px-5 py-3 font-medium">操作类型</th>
                  <th className="px-5 py-3 font-medium">操作人</th>
                  <th className="px-5 py-3 font-medium">操作对象</th>
                  <th className="px-5 py-3 font-medium">咨询信息</th>
                  <th className="px-5 py-3 font-medium">金额</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">摘要</th>
                </tr>
              </thead>
              <tbody>
                {records.items.map((record) => {
                  const infoRows = consultationInfoRows(record);
                  const objectRows = operationObjectRows(record);
                  const summary = visibleSummary(record);
                  return (
                    <tr key={record.id} className="border-t border-[var(--lxxl-border)] align-top">
                      <td className="px-5 py-4">
                        <div>{formatUtcFullDateTime(record.occurredAt)}</div>
                        {(record.createdAt || record.updatedAt) && (
                          <div className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                            {record.createdAt ? <div>创建：{formatUtcFullDateTime(record.createdAt)}</div> : null}
                            {record.updatedAt ? <div>更新：{formatUtcFullDateTime(record.updatedAt)}</div> : null}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium">{record.actionLabel}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{operationGroupLabel(record)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium">{record.operatorName || "-"}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                          <div>{record.operatorContact || "-"}</div>
                          <div>{roleLabel(record.operatorRole)}</div>
                          {record.operatorId ? <div>ID {record.operatorId}</div> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium">{targetTitle(record)}</div>
                        <div className="mt-1 space-y-0.5 text-xs leading-5 text-[var(--lxxl-muted)]">
                          {objectRows.map((row) => (
                            <div key={`${record.id}-${row.label}`}>
                              <span>{row.label}：</span>
                              <span>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {infoRows.length > 0 ? (
                          <div className="space-y-1 text-xs leading-5">
                            {infoRows.map((row) => (
                              <div className="grid grid-cols-[2.5rem_1fr] gap-2" key={`${record.id}-${row.label}`}>
                                <span className="text-[var(--lxxl-muted)]">{row.label}</span>
                                <span className="text-[var(--lxxl-ink)]">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--lxxl-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">{record.amount == null ? "-" : formatMoneyFromCents(record.amount)}</td>
                      <td className="px-5 py-4">
                        <Badge>{statusLabel(record.status)}</Badge>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-[var(--lxxl-muted)]">{summary || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
