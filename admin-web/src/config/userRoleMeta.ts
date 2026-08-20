import type { Role } from "@/types/api";

export const CREATABLE_ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "Counselor", label: "咨询师" },
  { value: "Assistant", label: "咨询助理" },
  { value: "Ops", label: "咨询主任" },
  { value: "Patient", label: "来访者" },
  { value: "Tester", label: "测试员" },
  { value: "Admin", label: "管理员" },
];

const STAFF_WORKBENCH_ROLES: Role[] = ["Assistant", "Ops", "Admin"];

const STAFF_ROLE_RANK: Partial<Record<Role, number>> = {
  Assistant: 1,
  Ops: 2,
  Admin: 3,
};

const ROLE_MANAGEMENT_ALLOWED: Record<Role, Role[]> = {
  Admin: ["Ops", "Assistant", "Counselor", "Patient", "Tester", "Admin"],
  Ops: ["Assistant", "Counselor", "Patient"],
  Assistant: ["Counselor", "Patient"],
  Counselor: [],
  Patient: [],
  Tester: [],
};

export function resolveHighestStaffRole(roles: Role[] = []): Role | null {
  let best: Role | null = null;
  let bestRank = 0;
  roles.forEach((role) => {
    const rank = STAFF_ROLE_RANK[role] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = role;
    }
  });
  return best;
}

function isStaffManagementRole(role: Role | string) {
  return STAFF_WORKBENCH_ROLES.includes(role as Role);
}

/** 与后端 staff_roles.can_actor_assign_role 对齐 */
export function canActorAssignRole(actorRole: Role | string, targetRole: Role | string) {
  if (!STAFF_WORKBENCH_ROLES.includes(actorRole as Role)) {
    return false;
  }
  if (targetRole === "Tester") {
    return actorRole === "Admin";
  }
  if (!isStaffManagementRole(targetRole)) {
    return true;
  }
  if (actorRole === "Admin" && targetRole === "Admin") {
    return true;
  }
  return (STAFF_ROLE_RANK[actorRole as Role] ?? 0) > (STAFF_ROLE_RANK[targetRole as Role] ?? 0);
}

/** 与后端 staff_roles.can_actor_manage_user 对齐 */
export function canActorManageUser(actorRole: Role | string, userRole: Role | string) {
  if (!STAFF_WORKBENCH_ROLES.includes(actorRole as Role)) {
    return false;
  }
  if (!isStaffManagementRole(userRole)) {
    return true;
  }
  if (actorRole === "Admin" && userRole === "Admin") {
    return true;
  }
  return (STAFF_ROLE_RANK[actorRole as Role] ?? 0) > (STAFF_ROLE_RANK[userRole as Role] ?? 0);
}

export function getManageableRoles(currentRoles: Role[] = []) {
  const manageable = new Set<Role>();
  currentRoles.forEach((role) => {
    ROLE_MANAGEMENT_ALLOWED[role]?.forEach((item) => manageable.add(item));
  });
  return CREATABLE_ROLE_OPTIONS.filter((option) => manageable.has(option.value));
}

export function canManageRole(currentRoles: Role[] = [], role: Role) {
  return getManageableRoles(currentRoles).some((option) => option.value === role);
}

/** 可编辑咨询师介绍页、调整代理预约待支付时限 */
export function canManageStaffOperationalSettings(roles: Role[] = []) {
  return roles.some((role) => role === "Admin" || role === "Ops" || role === "Assistant");
}

export const PATIENT_SOURCE_OPTIONS = [
  { value: "CHARITY", label: "公益" },
  { value: "PROFESSIONAL", label: "正价" },
  { value: "HOSPITAL", label: "医院" },
] as const;

export const PATIENT_SOURCE_DETAIL_OPTIONS = [
  "小红书",
  "大众点评",
  "公众号",
  "医院转出",
  "来访推荐",
  "老来访",
  "医生推荐",
  "其他",
] as const;

export const COUNSELOR_TYPE_OPTIONS = [
  { value: "CHARITY", label: "公益咨询师" },
  { value: "PROFESSIONAL", label: "专业咨询师" },
] as const;

export type PatientSource = (typeof PATIENT_SOURCE_OPTIONS)[number]["value"];
export type CounselorType = (typeof COUNSELOR_TYPE_OPTIONS)[number]["value"];
