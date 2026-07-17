import { apiRequest } from "@/lib/api";
import type { RiskAssessmentData } from "@/constants/caseRecordRiskAssessment";
import type {
  ApiMessage,
  CounselorCaseRecord,
  CounselorCaseRecordFormDefaults,
  CounselorCaseRecordRevision,
  CounselorCompletedConsultation,
  CounselorDashboardDetailItem,
  CounselorDashboardStats,
  CounselorScheduleCalendar,
  CounselorSlotOptions,
} from "@/types/api";

export type CounselorDashboardPeriod = "month" | "quarter" | "half_year" | "all";
export type CounselorDashboardCategory = "orders" | "case-records" | "appointments" | "leaves";

export interface CounselorScheduleFilters {
  start: string;
  days: number;
}

export interface CounselorCaseRecordPayload {
  consultation_id?: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  risk_assessment: RiskAssessmentData;
  header_info: Record<string, string>;
  photo_urls?: string[];
}

export interface CounselorCaseRecordAmendmentPayload extends CounselorCaseRecordPayload {
  reason: string;
}

export function fetchCounselorDashboard(period: CounselorDashboardPeriod) {
  return apiRequest<CounselorDashboardStats>(`/api/mini/counselor/stats?period=${period}`);
}

export function fetchCounselorDashboardDetails(
  category: CounselorDashboardCategory,
  period: CounselorDashboardPeriod,
) {
  const params = new URLSearchParams({ category, period });
  return apiRequest<CounselorDashboardDetailItem[]>(`/api/mini/counselor/stats/details?${params.toString()}`);
}

export function fetchCounselorScheduleCalendar(filters: CounselorScheduleFilters) {
  const params = new URLSearchParams({
    start: filters.start,
    days: String(filters.days),
  });
  return apiRequest<CounselorScheduleCalendar>(`/api/mini/counselor/schedules/calendar?${params.toString()}`);
}

export function fetchCounselorSlotOptions(date: string, centerId: string) {
  const params = new URLSearchParams({ date, center_id: centerId });
  return apiRequest<CounselorSlotOptions>(`/api/mini/counselor/schedules/slot-options?${params.toString()}`);
}

export function createCounselorSchedule(body: {
  start_time: string;
  end_time: string;
  center_id: string;
  room_id?: string;
}) {
  return apiRequest<ApiMessage>("/api/mini/counselor/schedules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function cancelCounselorSchedule(
  scheduleId: number,
  body: { leave_reason?: string; communication_screenshot_url?: string } = {},
) {
  return apiRequest<ApiMessage>(`/api/mini/counselor/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "CANCELLED", ...body }),
  });
}

export function submitCounselorLeaveRequest(scheduleId: number, reason: string) {
  return apiRequest<ApiMessage>(`/api/mini/counselor/schedules/${scheduleId}/leave-request`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchCounselorCompletedConsultations() {
  return apiRequest<CounselorCompletedConsultation[]>("/api/mini/counselor/consultations/completed");
}

export function fetchCounselorCaseRecords() {
  return apiRequest<CounselorCaseRecord[]>("/api/mini/counselor/case-records");
}

export function fetchCounselorCaseRecord(recordId: number) {
  return apiRequest<CounselorCaseRecord>(`/api/mini/counselor/case-records/${recordId}`);
}

export function fetchCounselorCaseRecordRevisions(recordId: number) {
  return apiRequest<CounselorCaseRecordRevision[]>(`/api/mini/counselor/case-records/${recordId}/revisions`);
}

export function fetchCounselorCaseRecordDefaults(consultationId: number) {
  return apiRequest<CounselorCaseRecordFormDefaults>(
    `/api/mini/counselor/case-records/form-defaults?consultation_id=${consultationId}`,
  );
}

export function createCounselorCaseRecord(body: CounselorCaseRecordPayload) {
  return apiRequest<CounselorCaseRecord>("/api/mini/counselor/case-records", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function requestCounselorCaseRecordAmendment(
  recordId: number,
  body: CounselorCaseRecordAmendmentPayload,
) {
  return apiRequest<CounselorCaseRecord>(`/api/mini/counselor/case-records/${recordId}/amendment-requests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
