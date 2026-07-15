import { sectionPathById } from "@/config/navigation";
import type { MessageItem, Role } from "@/types/api";

type MessagePayload = {
  summary?: unknown;
  detail?: Record<string, unknown>;
};

export type MessageActionTarget = {
  href: string;
  label: string;
  description: string;
};

const opsReviewRoles = new Set<Role>(["Admin", "Ops"]);
const staffReviewRoles = new Set<Role>(["Admin", "Ops", "Assistant"]);
const counselorScheduleTypes = new Set([
  "COUNSELOR_APPOINTMENT_NEW",
  "COUNSELOR_CONSULTATION_REMIND",
  "COUNSELOR_APPOINTMENT_CANCEL",
  "COUNSELOR_LEAVE_SUBMITTED",
  "COUNSELOR_LEAVE_SUCCESS",
  "COUNSELOR_LEAVE_REJECTED",
  "COUNSELOR_PROXY_ORDER_PENDING",
]);

export function resolveMessageActionTarget(
  item: MessageItem,
  activeRole?: Role | string | null,
): MessageActionTarget | null {
  const detail = parseMessagePayload(item.Content)?.detail || {};
  const relatedType = item.RelatedType || "";

  if (canReviewAsStaff(activeRole)) {
    if (isExemptionPendingMessage(item)) {
      return {
        href: buildHref(sectionPathById.refunds, {
          category: "EXEMPTION",
          status: "PENDING",
          exemptionId: firstNumber(detail.refundExemptionId, detail.exemptionId, item.RelatedId),
          messageId: item.Id,
        }),
        label: "前往用户豁免审核",
        description: "进入这条豁免申请的审核入口，完成通过或驳回处理。",
      };
    }

    if (relatedType === "COUNSELOR_LEAVE") {
      return {
        href: buildHref(sectionPathById.refunds, {
          category: "LEAVE",
          status: "PENDING",
          leaveId: firstNumber(detail.leaveRequestId, item.RelatedId),
          messageId: item.Id,
        }),
        label: "前往请假审核",
        description: "进入这条咨询师请假申请的审核入口，完成通过或拒绝处理。",
      };
    }
  }

  if (canReviewAsOpsAdmin(activeRole)) {

    if (isCaseRecordAmendmentPendingMessage(item)) {
      return {
        href: buildHref(sectionPathById.caseRecords, {
          amendmentId: firstNumber(detail.amendmentId, detail.caseRecordAmendmentId, item.RelatedId),
          messageId: item.Id,
        }),
        label: "前往修改审核",
        description: "进入咨询记录修改审核入口，处理这条修改申请。",
      };
    }

    if (isCrisisReportMessage(item)) {
      const recordId = firstNumber(detail.caseRecordId, detail.recordId, item.RelatedId);
      if (!recordId) {
        return null;
      }
      return {
        href: buildHref(sectionPathById.caseRecords, { recordId, messageId: item.Id }),
        label: "查看咨询记录",
        description: "查看这条风险上报关联的咨询记录，再按线下流程继续处理。",
      };
    }

    if (relatedType === "FEEDBACK") {
      return {
        href: buildHref(sectionPathById.feedback, {
          feedbackId: firstNumber(detail.feedbackId, item.RelatedId),
          messageId: item.Id,
        }),
        label: "查看咨询反馈",
        description: "进入这条咨询反馈的处理入口。",
      };
    }

  }

  if (activeRole === "Counselor") {
    if (relatedType === "CASE_RECORD_AMENDMENT") {
      const recordId = firstNumber(detail.caseRecordId, detail.recordId, item.RelatedId);
      if (!recordId) {
        return null;
      }
      return {
        href: buildHref(sectionPathById.counselorRecords, { recordId, messageId: item.Id }),
        label: "查看咨询记录",
        description: "进入这条咨询记录，查看修改审核结果或继续按结果处理。",
      };
    }

    if (relatedType === "COUNSELOR_CONSULTATION_DONE") {
      const consultationId = firstNumber(detail.consultationId, item.RelatedId);
      if (!consultationId) {
        return null;
      }
      return {
        href: buildHref(sectionPathById.counselorRecords, { consultationId, messageId: item.Id }),
        label: "填写咨询记录",
        description: "进入这次已完成咨询的记录填写入口。",
      };
    }

    if (counselorScheduleTypes.has(relatedType)) {
      return {
        href: buildHref(sectionPathById.counselorSchedules, {
          scheduleId: firstNumber(detail.scheduleId, item.RelatedId),
          consultationId: firstNumber(detail.consultationId),
          start: dateValueFromUnknown(detail.startTime),
          messageId: item.Id,
        }),
        label: "查看排期详情",
        description: "进入这条消息对应的排期或预约详情。",
      };
    }
  }

  return null;
}

function canReviewAsOpsAdmin(activeRole?: Role | string | null) {
  return activeRole === "Admin" || activeRole === "Ops" || opsReviewRoles.has(activeRole as Role);
}

function canReviewAsStaff(activeRole?: Role | string | null) {
  return staffReviewRoles.has(activeRole as Role);
}

function isExemptionPendingMessage(item: MessageItem) {
  const relatedType = item.RelatedType || "";
  if (relatedType === "REFUND_EXEMPTION_PENDING") {
    return true;
  }
  if (relatedType !== "REFUND_EXEMPTION") {
    return false;
  }
  const detail = parseMessagePayload(item.Content)?.detail;
  return detail?.status === "PENDING" || (item.Title || "").includes("待审核");
}

function isCaseRecordAmendmentPendingMessage(item: MessageItem) {
  const relatedType = item.RelatedType || "";
  if (relatedType === "CASE_RECORD_AMENDMENT_PENDING") {
    return true;
  }
  if (relatedType !== "CASE_RECORD_AMENDMENT") {
    return false;
  }
  const detail = parseMessagePayload(item.Content)?.detail;
  return detail?.status === "PENDING" || (item.Title || "").includes("待审核");
}

function isCrisisReportMessage(item: MessageItem) {
  if (item.RelatedType === "CASE_RECORD_CRISIS_REPORT") {
    return true;
  }
  const title = item.Title || "";
  if (title.includes("个案风险需上报") || title.includes("风险需上报")) {
    return true;
  }
  return item.Type === "RISK" && title.includes("风险");
}

function parseMessagePayload(content?: string | null): MessagePayload | undefined {
  if (!content) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MessagePayload;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = numberFromUnknown(value);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValueFromUnknown(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
}

function buildHref(path: string, params: Record<string, number | string | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
