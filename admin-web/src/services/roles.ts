import { apiRequest } from "@/lib/api";
import type { AdminUser, Role } from "@/types/api";

export function fetchAdminUsers() {
  return apiRequest<AdminUser[]>("/api/mini/admin/users");
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
