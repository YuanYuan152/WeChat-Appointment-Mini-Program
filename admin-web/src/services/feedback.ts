import { apiRequest } from "@/lib/api";
import type { FeedbackItem, OperationRecord, PagedResult } from "@/types/api";

export async function fetchFeedbacks(status = "ALL") {
  const pageSize = 100;
  const firstPage = await fetchConsultationFeedbackPage(1, pageSize);
  const records = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await fetchConsultationFeedbackPage(page, pageSize);
    records.push(...result.items);
  }

  return records.map((record) => mapConsultationFeedback(record)).filter((item) => status === "ALL" || item.status === status);
}

function fetchConsultationFeedbackPage(page: number, pageSize: number) {
  const params = new URLSearchParams({
    action_type: "CONSULTATION_FEEDBACK",
    page: String(page),
    page_size: String(pageSize),
  });

  return apiRequest<PagedResult<OperationRecord>>(`/api/web/admin/operation-records?${params.toString()}`);
}

function mapConsultationFeedback(record: OperationRecord): FeedbackItem {
  return {
    id: record.targetId ?? (Number(record.id.replace(/\D/g, "")) || 0),
    accountId: record.patientId ?? record.operatorId ?? 0,
    userName: record.patientName || record.operatorName || record.targetName || "来访者",
    patientContractTag: record.patientContractTag || null,
    userMobile: record.patientContact || record.operatorContact || null,
    category: "咨询反馈",
    content: record.summary || "-",
    contact: record.patientContact || record.operatorContact || null,
    status: "SUBMITTED",
    createdAt: record.occurredAt || record.createdAt || "",
  };
}
