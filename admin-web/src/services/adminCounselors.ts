import { apiRequest } from "@/lib/api";
import type { AdminCounselorIntroProfile, AdminCounselorIntroUpdatePayload } from "@/types/api";

export function fetchAdminCounselorIntro(counselorId: number) {
  return apiRequest<AdminCounselorIntroProfile>(`/api/mini/admin/counselors/${counselorId}`);
}

export function updateAdminCounselorIntro(
  counselorId: number,
  payload: AdminCounselorIntroUpdatePayload,
) {
  return apiRequest<AdminCounselorIntroProfile>(`/api/mini/admin/counselors/${counselorId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
