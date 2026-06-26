import type { Role } from "@/types/api";

import type { NavigationGroup, NavigationSection } from "@/types/app";

export const sections: NavigationSection[] = [
  { id: "dashboard", label: "总览", desc: "运营数据和待办", path: "/" },
  { id: "messages", label: "我的消息", desc: "消息提醒和待处理事项", path: "/messages" },
  { id: "roles", label: "用户与角色", desc: "管理员角色绑定", path: "/admin-roles", adminOnly: true },
  { id: "refunds", label: "豁免审核", desc: "退款豁免处理", path: "/refund-exemptions" },
  { id: "feedback", label: "用户反馈", desc: "查看用户反馈详情", path: "/feedback" },
  { id: "content", label: "内容管理", desc: "Banner / 活动 / 文章", path: "/ops-content" },
  { id: "schedules", label: "排期情况", desc: "咨询师排期总览", path: "/schedules" },
  { id: "rooms", label: "咨询室情况", desc: "咨询室状态与占用", path: "/rooms" },
  { id: "caseRecords", label: "咨询记录", desc: "记录提交概览", path: "/case-records" },
  { id: "operationLogs", label: "操作记录", desc: "现有业务记录入口", path: "/operation-logs" },
  { id: "userBoard", label: "用户管理", desc: "来访者和咨询师检索", path: "/user-board" },
  { id: "counselorBoard", label: "咨询师看板", desc: "咨询师记录概览", path: "/counselor-board" },
];

export const sectionPathById = Object.fromEntries(
  sections.map((section) => [section.id, section.path]),
) as Record<NavigationSection["id"], string>;

export const navigationGroups: NavigationGroup[] = [
  { id: "overview", label: "工作台", sectionIds: ["dashboard", "messages"] },
  { id: "admin", label: "权限管理", sectionIds: ["roles"] },
  { id: "business", label: "业务处理", sectionIds: ["refunds", "feedback", "caseRecords", "operationLogs"] },
  { id: "operation", label: "运营配置", sectionIds: ["content", "schedules", "rooms"] },
  { id: "boards", label: "数据看板", sectionIds: ["userBoard", "counselorBoard"] },
];

export function getSectionById(sectionId: NavigationSection["id"]) {
  return sections.find((section) => section.id === sectionId);
}

export function getNavigationGroupBySection(sectionId: NavigationSection["id"]) {
  return navigationGroups.find((group) => group.sectionIds.includes(sectionId));
}

export const roles: Role[] = ["Patient", "Counselor", "Assistant", "Ops", "Admin"];
