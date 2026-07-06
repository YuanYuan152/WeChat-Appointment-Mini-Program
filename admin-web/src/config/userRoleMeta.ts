import type { Role } from "@/types/api";

export const CREATABLE_ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "Counselor", label: "咨询师" },
  { value: "Assistant", label: "咨询助理" },
  { value: "Ops", label: "运营" },
  { value: "Patient", label: "来访者" },
  { value: "Admin", label: "管理员" },
];

const ROLE_MANAGEMENT_ALLOWED: Record<Role, Role[]> = {
  Admin: ["Admin", "Ops", "Assistant", "Counselor", "Patient"],
  Ops: ["Assistant", "Counselor", "Patient"],
  Assistant: ["Counselor", "Patient"],
  Counselor: [],
  Patient: [],
};

export function getManageableRoles(currentRoles: Role[] = []) {
  const manageable = new Set<Role>();
  currentRoles.forEach((role) => {
    ROLE_MANAGEMENT_ALLOWED[role].forEach((item) => manageable.add(item));
  });
  return CREATABLE_ROLE_OPTIONS.filter((option) => manageable.has(option.value));
}

export function canManageRole(currentRoles: Role[] = [], role: Role) {
  return getManageableRoles(currentRoles).some((option) => option.value === role);
}

export const PATIENT_SOURCE_OPTIONS = [
  { value: "MINI_PROGRAM", label: "小程序注册" },
  { value: "CHARITY_VISITOR", label: "公益来访" },
  { value: "CHARITY_PROJECT_1", label: "公益项目1" },
  { value: "CHARITY_PROJECT_2", label: "公益项目2" },
  { value: "HOSPITAL", label: "医院" },
] as const;

export const COUNSELOR_TYPE_OPTIONS = [
  { value: "CHARITY", label: "公益咨询师" },
  { value: "PROFESSIONAL", label: "专业咨询师" },
] as const;

export type PatientSource = (typeof PATIENT_SOURCE_OPTIONS)[number]["value"];
export type CounselorType = (typeof COUNSELOR_TYPE_OPTIONS)[number]["value"];
