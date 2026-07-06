import { apiRequest } from "@/lib/api";
import type { AdminUser, AdminUsersResponse, Role } from "@/types/api";

export interface CreateUserByMobilePayload {
  mobile: string;
  role: Role;
  nickname?: string;
  patient_source?: string;
  counselor_type?: string;
}

export function fetchAdminUsers() {
  return apiRequest<AdminUsersResponse | AdminUser[]>("/api/mini/admin/users?page=1&page_size=500").then((result) =>
    Array.isArray(result) ? result : result.items,
  );
}

export function createUserByMobile(payload: CreateUserByMobilePayload) {
  return apiRequest<AdminUser>("/api/mini/admin/users/by-mobile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bindUserRole(userId: number, role: Role) {
  return apiRequest(`/api/mini/admin/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export function unbindUserRole(userId: number, role: Role) {
  return apiRequest(`/api/mini/admin/users/${userId}/roles/${role}`, {
    method: "DELETE",
  });
}
