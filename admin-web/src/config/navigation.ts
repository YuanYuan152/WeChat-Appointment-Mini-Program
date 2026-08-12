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
    id: "proxyBooking",
    label: "代理预约",
    desc: "代来访推送待支付订单",
    path: "/proxy-booking",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  {
    id: "roles",
    label: "用户与角色",
    desc: "创建账号与角色绑定",
    path: "/admin-roles",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  {
    id: "refunds",
    label: "审核管理",
    desc: "用户豁免与请假审核",
    path: "/reviews",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  { id: "feedback", label: "咨询反馈", desc: "查看咨询反馈详情", path: "/feedback", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "content", label: "内容管理", desc: "Banner / 活动 / 文章", path: "/ops-content", allowedRoles: ["Admin", "Ops", "Assistant"] },
  {
    id: "assessments",
    label: "量表管理",
    desc: "新增、编辑、发布与归档 EAP 量表",
    path: "/assessments",
    allowedRoles: ["Admin", "Ops"],
  },
  {
    id: "assessmentReports",
    label: "量表结果",
    desc: "查看来访者量表填写报告",
    path: "/assessment-reports",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  { id: "schedules", label: "排期情况", desc: "咨询师排期总览", path: "/schedules", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "rooms", label: "咨询室情况", desc: "咨询室状态与占用", path: "/rooms", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "pricing", label: "调价管理", desc: "基础价与个体调价", path: "/pricing", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "caseRecords", label: "咨询记录", desc: "记录提交概览", path: "/case-records", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "operationLogs", label: "操作记录", desc: "现有业务记录入口", path: "/operation-logs", allowedRoles: ["Admin", "Ops", "Assistant"] },
  { id: "dataImport", label: "数据导入&导出", desc: "按类型导入与导出 Excel 数据", path: "/data-import", allowedRoles: ["Admin", "Ops", "Assistant"] },
  {
    id: "userBoard",
    label: "来访管理",
    desc: "来访资料与预约记录",
    path: "/user-board",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  {
    id: "counselorBoard",
    label: "咨询师管理",
    desc: "资料、记录与内部备注",
    path: "/counselor-board",
    allowedRoles: ["Admin", "Ops", "Assistant"],
  },
  {
    id: "counselorDashboard",
    label: "个人看板",
    desc: "咨询数据与明细",
    path: "/counselor-dashboard",
    allowedRoles: ["Counselor"],
  },
  {
    id: "counselorOrderDetails",
    label: "订单明细",
    desc: "完成订单和收入明细",
    path: "/counselor-order-details",
    allowedRoles: ["Counselor"],
  },
  {
    id: "counselorConsultationDetails",
    label: "咨询明细",
    desc: "咨询记录和预约咨询",
    path: "/counselor-consultation-details",
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
  { id: "overview", label: "工作台", sectionIds: ["dashboard", "messages", "proxyBooking"] },
  { id: "admin", label: "权限管理", sectionIds: ["roles"] },
  { id: "business", label: "业务处理", sectionIds: ["refunds", "feedback", "caseRecords", "operationLogs", "dataImport"] },
  {
    id: "operation",
    label: "运营配置",
    sectionIds: [
      "content",
      "assessments",
      "assessmentReports",
      "schedules",
      "rooms",
      "pricing",
    ],
  },
  { id: "boards", label: "用户管理", sectionIds: ["userBoard", "counselorBoard"] },
  {
    id: "counselor",
    label: "咨询师工作台",
    sectionIds: [
      "counselorDashboard",
      "counselorOrderDetails",
      "counselorConsultationDetails",
      "counselorSchedules",
      "counselorRecords",
    ],
  },
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
    return "messages";
  }
  if (rolesValue.includes("Counselor")) {
    return "counselorDashboard";
  }
  return "messages";
}
