import type { Role } from "@/types/api";

import type { NavigationGroup, NavigationSection } from "@/types/app";

export const sections: NavigationSection[] = [
  { id: "dashboard", label: "总览", desc: "运营数据和待办", path: "/", allowedRoles: ["Admin", "Ops"] },
  {
    id: "messages",
    label: "我的消息",
    desc: "消息提醒和待处理事项",
    path: "/messages",
    allowedRoles: ["Admin", "Ops", "Assistant", "Counselor"],
  },
  {
    id: "roles",
    label: "用户与角色",
    desc: "创建账号与角色绑定",
    path: "/admin-roles",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  { id: "refunds", label: "豁免审核", desc: "退款豁免处理", path: "/refund-exemptions", allowedRoles: ["Admin", "Ops"] },
  { id: "feedback", label: "咨询反馈", desc: "查看咨询反馈详情", path: "/feedback", allowedRoles: ["Admin", "Ops"] },
  { id: "content", label: "内容管理", desc: "Banner / 活动 / 文章", path: "/ops-content", allowedRoles: ["Admin", "Ops"] },
  { id: "schedules", label: "排期情况", desc: "咨询师排期总览", path: "/schedules", allowedRoles: ["Admin", "Ops"] },
  { id: "rooms", label: "咨询室情况", desc: "咨询室状态与占用", path: "/rooms", allowedRoles: ["Admin", "Ops"] },
  { id: "pricing", label: "调价管理", desc: "基础价与个体调价", path: "/pricing", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "caseRecords", label: "咨询记录", desc: "记录提交概览", path: "/case-records", allowedRoles: ["Admin", "Ops"] },
  { id: "operationLogs", label: "操作记录", desc: "现有业务记录入口", path: "/operation-logs", allowedRoles: ["Admin", "Ops"] },
  { id: "dataImport", label: "数据导入", desc: "导入完成订单", path: "/data-import", allowedRoles: ["Admin", "Ops"] },
  { id: "userBoard", label: "用户管理", desc: "来访者和咨询师检索", path: "/user-board", allowedRoles: ["Admin", "Ops"] },
  { id: "counselorBoard", label: "咨询师管理", desc: "资料与记录管理", path: "/counselor-board", allowedRoles: ["Admin", "Ops"] },
  {
    id: "counselorDashboard",
    label: "个人看板",
    desc: "咨询数据与明细",
    path: "/counselor-dashboard",
    allowedRoles: ["Counselor"],
  },
  {
    id: "counselorSchedules",
    label: "我的排期",
    desc: "新增排期和请假",
    path: "/counselor-schedules",
    allowedRoles: ["Counselor"],
  },
  {
    id: "counselorRecords",
    label: "填写咨询记录",
    desc: "记录填写与修改申请",
    path: "/counselor-records",
    allowedRoles: ["Counselor"],
  },
];

export const sectionPathById = Object.fromEntries(
  sections.map((section) => [section.id, section.path]),
) as Record<NavigationSection["id"], string>;

export const navigationGroups: NavigationGroup[] = [
  { id: "overview", label: "工作台", sectionIds: ["dashboard", "messages"] },
  { id: "admin", label: "权限管理", sectionIds: ["roles"] },
  { id: "business", label: "业务处理", sectionIds: ["refunds", "feedback", "caseRecords", "operationLogs", "dataImport"] },
  { id: "operation", label: "运营配置", sectionIds: ["content", "schedules", "rooms", "pricing"] },
  { id: "boards", label: "数据看板", sectionIds: ["userBoard", "counselorBoard"] },
  { id: "counselor", label: "咨询师工作台", sectionIds: ["counselorDashboard", "counselorSchedules", "counselorRecords"] },
];

export function getSectionById(sectionId: NavigationSection["id"]) {
  return sections.find((section) => section.id === sectionId);
}

export function getNavigationGroupBySection(sectionId: NavigationSection["id"]) {
  return navigationGroups.find((group) => group.sectionIds.includes(sectionId));
}

export const roles: Role[] = ["Patient", "Counselor", "Assistant", "Ops", "Admin"];

export function canAccessSection(section: NavigationSection | undefined, rolesValue: Role[]) {
  if (!section) {
    return false;
  }
  if (section.adminOnly && !rolesValue.includes("Admin")) {
    return false;
  }
  if (!section.allowedRoles || section.allowedRoles.length === 0) {
    return true;
  }
  return rolesValue.some((role) => section.allowedRoles?.includes(role));
}

export function getDefaultSectionId(rolesValue: Role[]): NavigationSection["id"] {
  if (rolesValue.some((role) => role === "Admin" || role === "Ops")) {
    return "dashboard";
  }
  if (rolesValue.includes("Assistant")) {
    return "roles";
  }
  if (rolesValue.includes("Counselor")) {
    return "counselorDashboard";
  }
  return "messages";
}
