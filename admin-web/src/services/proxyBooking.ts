import { apiRequest } from "@/lib/api";
import type {
  ProxyPushOrderResult,
  ProxyScheduleCalendar,
  ProxySearchResult,
  ProxySlotOptions,
} from "@/types/api";

const BASE_PATH = "/api/mini/admin/proxy-booking";

function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function searchProxyPatients(keyword: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  return apiRequest<ProxySearchResult>(withQuery(`${BASE_PATH}/patients`, params));
}

export function searchProxyCounselors(keyword: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  return apiRequest<ProxySearchResult>(withQuery(`${BASE_PATH}/counselors`, params));
}

export function fetchProxyScheduleCalendar(input: { counselorId: number; start: string; days: number }) {
  const params = new URLSearchParams({
    counselor_id: String(input.counselorId),
    start: input.start,
    days: String(input.days),
  });
  return apiRequest<ProxyScheduleCalendar>(`${BASE_PATH}/calendar?${params.toString()}`);
}

export function fetchProxySlotOptions(input: { counselorId: number; date: string; centerId: string }) {
  const params = new URLSearchParams({
    counselor_id: String(input.counselorId),
    date: input.date,
    center_id: input.centerId,
  });
  return apiRequest<ProxySlotOptions>(`${BASE_PATH}/slot-options?${params.toString()}`);
}

export function pushProxyOrder(input: {
  patientId: number;
  counselorId: number;
  centerId: string;
  startTime: string;
  endTime: string;
  roomId?: string;
  scheduleId?: number;
}) {
  return apiRequest<ProxyPushOrderResult>(`${BASE_PATH}/push-order`, {
    method: "POST",
    body: JSON.stringify({
      patient_id: input.patientId,
      counselor_id: input.counselorId,
      center_id: input.centerId,
      start_time: input.startTime,
      end_time: input.endTime,
      room_id: input.roomId || undefined,
      schedule_id: input.scheduleId || undefined,
    }),
  });
}
