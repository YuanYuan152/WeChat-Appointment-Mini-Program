import type { Dispatch, FormEvent, SetStateAction } from "react";

import { formatFullDateTime, formatMoneyFromCents, roleLabel, statusLabel } from "@/lib/format";
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
  CONSULTATION: "预约/取消预约",
  SCHEDULE: "排期记录",
  CASE_RECORD: "咨询记录",
  CASE_RECORD_AMENDMENT: "咨询记录修改",
  CONSULTATION_FEEDBACK: "咨询反馈",
  LEAVE_REQUEST: "咨询师请假",
  SCHEDULE_CANCEL: "咨询师取消排期",
  ROOM: "咨询室管理",
  CONTENT: "内容管理",
  ROLE_SWITCH: "角色切换",
  OFFLINE_PAYMENT_PUSH: "推送线下支付单",
  OFFLINE_RECEIPT: "确认线下收款",
  PROXY_PUSH_PENDING: "助理推送待支付订单",
  PROXY_PUSH_FREE: "助理推送免费体验订单",
  PROXY_PUSH_OFFLINE: "助理推送线下支付订单",
  PROXY_CANCEL_PUSH: "助理取消待支付推送",
  COUNSELOR_PUSH_ORDER: "咨询师推送订单",
  PATIENT_PAY_ORDER: "来访预约支付",
  PATIENT_CONFIRM_ORDER: "来访确认订单",
  PATIENT_CANCEL_ORDER: "来访取消订单",
  COUNSELOR_LEAVE: "咨询师请假",
  COUNSELOR_SCHEDULE_CREATE: "咨询师新建排期",
  COUNSELOR_SCHEDULE_UPDATE: "咨询师修改排期",
  COUNSELOR_SCHEDULE_CANCEL: "咨询师取消排期",
  ASSISTANT_RESCHEDULE: "助理修改预约时间",
  ASSISTANT_CHANGE_ROOM: "助理更换咨询室",
  CASE_RECORD_SAVE: "保存咨询记录",
  CASE_RECORD_AMENDMENT_SUBMIT: "提交咨询记录修改",
  LEAVE_APPROVE: "同意咨询师请假",
  LEAVE_REJECT: "拒绝咨询师请假",
  CONTENT_BANNER_SAVE: "保存 Banner",
  CONTENT_BANNER_DELETE: "删除 Banner",
  CONTENT_SITE_PAGE_SAVE: "保存站点页面",
  CONTENT_GUIDE_SAVE: "保存引导内容",
  CONTENT_GUIDE_DELETE: "删除引导内容",
  CONTENT_ACTIVITY_SAVE: "保存活动公告",
  CONTENT_ACTIVITY_DELETE: "删除活动公告",
  CONTENT_ARTICLE_SAVE: "保存文章",
  CONTENT_ARTICLE_DELETE: "删除文章",
  ROOM_SAVE: "保存咨询室",
  ROOM_DELETE: "删除咨询室",
  ROOM_SLOT_SAVE: "保存咨询室时段",
  PRICING_BASE: "修改咨询师基础价",
  PRICING_DEFAULT_SHARE: "修改咨询师默认分成",
  PRICING_PATIENT: "修改来访调价与分成",
  USER_CREATE: "新建用户",
  USER_ROLE_SET: "设置用户角色",
  USER_DELETE: "删除用户",
  USER_SHELL_CLEANUP: "清理空壳用户",
  EXEMPTION_REVIEW: "审核退款豁免",
  CASE_RECORD_AMENDMENT_REVIEW: "审核咨询记录修改",
  STAFF_REMARK: "修改员工备注",
  PATIENT_COUNSELOR_BIND: "绑定签约咨询师",
  PATIENT_SOURCE_UPDATE: "修改来访类型",
  COUNSELOR_VISIBILITY: "修改咨询师公开可见",
  COUNSELOR_DISPLAY_ORDER: "调整咨询师展示顺序",
  COUNSELOR_PROFILE_UPDATE: "修改咨询师资料",
  STAFF_PROFILE_UPDATE: "保存我的资料",
  ADMIN_LOGIN: "管理端登录",
  ADMIN_PASSWORD_CHANGE: "修改管理端密码",
  SYSTEM_FEEDBACK: "更新系统反馈状态",
  DATA_IMPORT: "导入数据",
  ENTERPRISE_DEFAULT_SAVE: "保存企业站默认设置",
  ENTERPRISE_SAVE: "保存企业定制",
  ENTERPRISE_DELETE: "删除企业定制",
  ENTERPRISE_COUNSELOR_SAVE: "保存企业咨询师勾选",
  ENTERPRISE_ARTICLE_SAVE: "保存企业图文",
  ENTERPRISE_ARTICLE_DELETE: "删除企业图文",
  ENTERPRISE_PERSONNEL_GENERATE: "生成企业人员账号",
  ENTERPRISE_PERSONNEL_EXPORT: "导出企业人员表",
  ENTERPRISE_PERSONNEL_DELETE: "删除企业人员表",
  DEFINITION_CREATE: "新建量表",
  DEFINITION_UPDATE: "保存量表草稿",
  DEFINITION_PUBLISH: "发布量表",
  DEFINITION_ARCHIVE: "归档量表",
  DEFINITION_DELETE: "删除量表",
  DEFINITION_RESTORE: "恢复量表版本",
  REPORT_DELETE: "删除量表结果",
};

const targetTypeLabels: Record<string, string> = {
  Account: "账号",
  Order: "订单",
  Consultation: "咨询预约",
  CaseRecord: "咨询记录",
  CaseRecordAmendment: "咨询记录修改申请",
  RefundExemption: "豁免申请",
  LeaveRequest: "请假申请",
  Schedule: "排期",
  ConsultationRoom: "咨询室",
  RoomSlot: "咨询室时段",
  ConsultationFeedback: "咨询反馈",
  Banner: "Banner",
  Activity: "活动公告",
  Article: "文章",
  Enterprise: "企业定制",
  EnterpriseArticle: "企业图文",
  EnterpriseDefault: "企业站默认设置",
  Pricing: "定价",
  Feedback: "系统反馈",
  DataImport: "数据导入",
  DataTransfer: "数据导入",
  SitePage: "站点页面",
  GuideItem: "引导内容",
};

function operationGroupLabel(record: OperationRecord) {
  return actionTypeLabels[record.actionType] || record.actionLabel || "业务记录";
}

function targetTypeLabel(record: OperationRecord) {
  return record.targetType ? targetTypeLabels[record.targetType] || record.targetType : "关联业务";
}

function withContact(name?: string | null, contact?: string | null, contractTag?: string | null) {
  if (!name && !contact) {
    return null;
  }
  if (!name) {
    return contact || null;
  }
  const displayName = contractTag ? `${name} ${contractTag}` : name;
  return contact ? `${displayName}（${contact}）` : displayName;
}

function patientName(record: OperationRecord) {
  if (!record.patientName) return "";
  return record.patientContractTag
    ? `${record.patientName} ${record.patientContractTag}`
    : record.patientName;
}

function targetTitle(record: OperationRecord) {
  const type = targetTypeLabel(record);
  if (record.targetType === "Consultation" && record.patientName && record.counselorName) {
    return `预约：${patientName(record)} / ${record.counselorName}`;
  }
  if (record.targetType === "CaseRecord" && record.patientName && record.counselorName) {
    return `咨询记录：${patientName(record)} / ${record.counselorName}`;
  }
  if (record.targetType === "CaseRecordAmendment" && record.patientName && record.counselorName) {
    return `记录修改：${patientName(record)} / ${record.counselorName}`;
  }
  if (record.targetType === "RefundExemption" && record.patientName) {
    return `豁免申请：${patientName(record)}`;
  }
  if (record.targetType === "LeaveRequest" && record.counselorName) {
    return `请假申请：${record.counselorName}`;
  }
  if (record.targetType === "Schedule" && record.counselorName) {
    return `排期：${record.counselorName}`;
  }
  if (record.targetType === "ConsultationFeedback" && record.patientName) {
    return `咨询反馈：${patientName(record)}`;
  }
  if (record.targetName) {
    return `${type}：${record.targetName}`;
  }
  if (record.patientName && record.counselorName) {
    return `咨询：${patientName(record)} / ${record.counselorName}`;
  }
  if (record.patientName) {
    return `来访者：${patientName(record)}`;
  }
  if (record.counselorName) {
    return `咨询师：${record.counselorName}`;
  }
  return type;
}

function operationObjectRows(record: OperationRecord) {
  const rows: Array<{ label: string; value: string }> = [];
  const patient = withContact(record.patientName, record.patientContact, record.patientContractTag);
  const counselor = withContact(record.counselorName, record.counselorContact);

  if (patient) {
    rows.push({ label: "来访者", value: patient });
  }
  if (counselor) {
    rows.push({ label: "咨询师", value: counselor });
  }
  if (record.relatedOrderId && !(record.targetType === "Order" && record.targetId === record.relatedOrderId)) {
    rows.push({ label: "关联订单", value: "有关联订单" });
  }
  if (
    record.relatedConsultationId &&
    !(record.targetType === "Consultation" && record.targetId === record.relatedConsultationId)
  ) {
    rows.push({ label: "关联咨询", value: "有关联咨询" });
  }
  if (record.scheduleId && !(record.targetType === "Schedule" && record.targetId === record.scheduleId)) {
    rows.push({ label: "关联排期", value: "有关联排期" });
  }

  return rows;
}

function consultationInfoRows(record: OperationRecord) {
  const rows: Array<{ label: string; value: string }> = [];
  if (record.startTime || record.endTime) {
    rows.push({
      label: "时间",
      value: `${formatFullDateTime(record.startTime)} - ${formatFullDateTime(record.endTime)}`,
    });
  }
  if (record.centerName || record.roomName) {
    rows.push({
      label: "地点",
      value: [record.centerName, record.roomName].filter(Boolean).join(" / "),
    });
  }
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

function operationStatusLabel(record: OperationRecord) {
  const status = record.status;
  if (!status) {
    return "-";
  }
  if (record.actionType === "SCHEDULE") {
    const labels: Record<string, string> = {
      AVAILABLE: "可排期",
      OPEN: "可排期",
      BOOKED: "已预约",
      CANCELLED: "已取消",
      CANCELED: "已取消",
      EXPIRED: "已过期",
    };
    return labels[status] || statusLabel(status);
  }
  if (record.actionType === "CONSULTATION_FEEDBACK") {
    return "已提交";
  }
  return statusLabel(status);
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
            这个版本上线之后的写操作会逐条留下记录。更早的内容仍是当时业务数据的快照，无法补回上线前的操作过程。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="关键词">
            <input
              className={queryControlClass}
              placeholder="人名/电话/业务内容"
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
              <option value="Ops">咨询主任</option>
              <option value="Counselor">咨询师</option>
              <option value="Patient">来访者</option>
              <option value="Tester">测试员</option>
            </select>
          </QueryField>
          <QueryField label="操作类型">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={filters.actionType}
              onChange={(event) => setFilters((prev) => ({ ...prev, actionType: event.target.value }))}
            >
              <option value="">全部操作</option>
              <optgroup label="预约咨询">
                <option value="PROXY_PUSH_PENDING">助理推送待支付订单</option>
                <option value="PROXY_PUSH_FREE">助理推送免费体验订单</option>
                <option value="PROXY_PUSH_OFFLINE">助理推送线下支付订单</option>
                <option value="PROXY_CANCEL_PUSH">助理取消待支付推送</option>
                <option value="COUNSELOR_PUSH_ORDER">咨询师推送订单</option>
                <option value="PATIENT_PAY_ORDER">来访预约支付</option>
                <option value="PATIENT_CONFIRM_ORDER">来访确认订单</option>
                <option value="PATIENT_CANCEL_ORDER">来访取消订单</option>
                <option value="COUNSELOR_LEAVE">咨询师提交请假</option>
                <option value="LEAVE_APPROVE">同意咨询师请假</option>
                <option value="LEAVE_REJECT">拒绝咨询师请假</option>
                <option value="ASSISTANT_RESCHEDULE">助理修改预约时间</option>
                <option value="ASSISTANT_CHANGE_ROOM">助理更换咨询室</option>
                <option value="COUNSELOR_SCHEDULE_CREATE">咨询师新建排期</option>
                <option value="COUNSELOR_SCHEDULE_UPDATE">咨询师修改排期</option>
                <option value="COUNSELOR_SCHEDULE_CANCEL">咨询师取消排期</option>
              </optgroup>
              <optgroup label="运营配置">
                <option value="CONTENT_BANNER_SAVE">保存 Banner</option>
                <option value="CONTENT_BANNER_DELETE">删除 Banner</option>
                <option value="CONTENT_SITE_PAGE_SAVE">保存站点页面</option>
                <option value="CONTENT_GUIDE_SAVE">保存引导内容</option>
                <option value="CONTENT_GUIDE_DELETE">删除引导内容</option>
                <option value="CONTENT_ACTIVITY_SAVE">保存活动公告</option>
                <option value="CONTENT_ACTIVITY_DELETE">删除活动公告</option>
                <option value="CONTENT_ARTICLE_SAVE">保存文章</option>
                <option value="CONTENT_ARTICLE_DELETE">删除文章</option>
                <option value="ROOM_SAVE">保存咨询室</option>
                <option value="ROOM_DELETE">删除咨询室</option>
                <option value="ROOM_SLOT_SAVE">保存咨询室时段</option>
                <option value="PRICING_BASE">修改咨询师基础价</option>
                <option value="PRICING_DEFAULT_SHARE">修改咨询师默认分成</option>
                <option value="PRICING_PATIENT">修改来访调价与分成</option>
                <option value="DEFINITION_CREATE">新建量表</option>
                <option value="DEFINITION_UPDATE">保存量表草稿</option>
                <option value="DEFINITION_PUBLISH">发布量表</option>
                <option value="DEFINITION_ARCHIVE">归档量表</option>
                <option value="DEFINITION_DELETE">删除量表</option>
                <option value="DEFINITION_RESTORE">恢复量表版本</option>
                <option value="REPORT_DELETE">删除量表结果</option>
                <option value="ENTERPRISE_SAVE">保存企业定制</option>
                <option value="ENTERPRISE_DELETE">删除企业定制</option>
                <option value="ENTERPRISE_COUNSELOR_SAVE">保存企业咨询师勾选</option>
                <option value="ENTERPRISE_ARTICLE_SAVE">保存企业图文</option>
                <option value="ENTERPRISE_ARTICLE_DELETE">删除企业图文</option>
                <option value="ENTERPRISE_PERSONNEL_GENERATE">生成企业人员账号</option>
                <option value="ENTERPRISE_PERSONNEL_EXPORT">导出企业人员表</option>
                <option value="ENTERPRISE_PERSONNEL_DELETE">删除企业人员表</option>
              </optgroup>
              <optgroup label="后台操作">
                <option value="USER_CREATE">新建用户</option>
                <option value="USER_ROLE_SET">设置用户角色</option>
                <option value="USER_DELETE">删除用户</option>
                <option value="USER_SHELL_CLEANUP">清理空壳用户</option>
                <option value="EXEMPTION_REVIEW">审核退款豁免</option>
                <option value="CASE_RECORD_AMENDMENT_REVIEW">审核咨询记录修改</option>
                <option value="CASE_RECORD_SAVE">保存咨询记录</option>
                <option value="CASE_RECORD_AMENDMENT_SUBMIT">提交咨询记录修改</option>
                <option value="STAFF_REMARK">修改员工备注</option>
                <option value="PATIENT_COUNSELOR_BIND">绑定签约咨询师</option>
                <option value="PATIENT_SOURCE_UPDATE">修改来访类型</option>
                <option value="COUNSELOR_VISIBILITY">修改咨询师公开可见</option>
                <option value="COUNSELOR_DISPLAY_ORDER">调整咨询师展示顺序</option>
                <option value="COUNSELOR_PROFILE_UPDATE">修改咨询师资料</option>
                <option value="STAFF_PROFILE_UPDATE">保存我的资料</option>
                <option value="ADMIN_LOGIN">管理端登录</option>
                <option value="ADMIN_PASSWORD_CHANGE">修改管理端密码</option>
                <option value="SYSTEM_FEEDBACK">更新系统反馈状态</option>
                <option value="DATA_IMPORT">导入数据</option>
                <option value="ENTERPRISE_DEFAULT_SAVE">保存企业站默认设置</option>
              </optgroup>
              <optgroup label="原有业务快照">
                <option value="REFUND_EXEMPTION">用户豁免审核</option>
                <option value="ORDER">订单</option>
                <option value="CONSULTATION">预约/取消预约</option>
                <option value="SCHEDULE">排期</option>
                <option value="CASE_RECORD">咨询记录</option>
                <option value="CASE_RECORD_AMENDMENT">咨询记录修改</option>
                <option value="CONSULTATION_FEEDBACK">咨询反馈</option>
                <option value="LEAVE_REQUEST">咨询师请假</option>
                <option value="SCHEDULE_CANCEL">咨询师取消排期</option>
                <option value="ROOM">咨询室管理</option>
                <option value="CONTENT">内容管理</option>
                <option value="ROLE_SWITCH">角色切换</option>
                <option value="OFFLINE_PAYMENT_PUSH">推送线下支付单</option>
                <option value="OFFLINE_RECEIPT">确认线下收款</option>
              </optgroup>
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
                    <th className="px-5 py-3 font-medium">关联业务</th>
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
                          {/* 接口已按各表写入口径换算为带 +08:00 的北京时间，这里不再按 UTC 补 Z */}
                          <div>{formatFullDateTime(record.occurredAt)}</div>
                          {(record.createdAt || record.updatedAt) && (
                            <div className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                              {record.createdAt ? <div>创建：{formatFullDateTime(record.createdAt)}</div> : null}
                              {record.updatedAt ? <div>更新：{formatFullDateTime(record.updatedAt)}</div> : null}
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
                        <td className="px-5 py-4">
                          {record.amount == null ? "-" : formatMoneyFromCents(record.amount)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge>{operationStatusLabel(record)}</Badge>
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
