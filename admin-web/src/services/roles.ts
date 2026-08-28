import { apiRequest } from "@/lib/api";
import type { AdminUser, AdminUsersResponse, Role } from "@/types/api";

export interface FetchAdminUsersParams {
  keyword?: string;
  role_group?: string;
  subtype?: string;
  page?: number;
  page_size?: number;
}

export interface CreateUserByMobilePayload {
  mobile: string;
  role: Role;
  nickname?: string;
  patient_source?: string;
  counselor_type?: string;
}

export interface BindUserRolePayload {
  patient_source?: string;
  counselor_type?: string;
}

export function fetchAdminUsers(params: FetchAdminUsersParams = {}) {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 500));
  if (params.keyword?.trim()) {
    search.set("keyword", params.keyword.trim());
  }
  if (params.role_group?.trim()) {
    search.set("role_group", params.role_group.trim());
  }
  if (params.subtype?.trim()) {
    search.set("subtype", params.subtype.trim());
  }
  return apiRequest<AdminUsersResponse | AdminUser[]>(`/api/mini/admin/users?${search.toString()}`).then((result) =>
    Array.isArray(result) ? result : result.items,
  );
}

export function createUserByMobile(payload: CreateUserByMobilePayload) {
  return apiRequest<AdminUser>("/api/mini/admin/users/by-mobile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bindUserRole(userId: number, role: Role, payload: BindUserRolePayload = {}) {
  return apiRequest(`/api/mini/admin/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role, ...payload }),
  });
}

export function deleteUser(userId: number) {
  return apiRequest<{ message?: string; deletedUserId?: number }>(`/api/mini/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function unbindUserRole(userId: number, role: Role) {
  return apiRequest(`/api/mini/admin/users/${userId}/roles/${role}`, {
    method: "DELETE",
  });
}
