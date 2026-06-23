import type { Role } from "@/types/api";

import type { AdminSection } from "./types";

export const sections: AdminSection[] = [
  { id: "dashboard", label: "总览", desc: "运营数据和待办" },
  { id: "roles", label: "用户与角色", desc: "管理员角色绑定", adminOnly: true },
  { id: "refunds", label: "豁免审核", desc: "退款豁免处理" },
  { id: "content", label: "内容管理", desc: "Banner / 活动 / 文章" },
  { id: "schedules", label: "挂课情况", desc: "咨询师排期总览" },
  { id: "rooms", label: "咨询室情况", desc: "咨询室状态与占用" },
  { id: "caseRecords", label: "咨询记录", desc: "记录提交概览" },
  { id: "operationLogs", label: "操作记录", desc: "现有业务记录入口" },
  { id: "userBoard", label: "用户看板", desc: "用户检索与状态" },
  { id: "counselorBoard", label: "咨询师看板", desc: "咨询师记录概览" },
];

export const roles: Role[] = ["Patient", "Counselor", "Assistant", "Ops", "Admin"];

export const today = new Date().toISOString().slice(0, 10);
