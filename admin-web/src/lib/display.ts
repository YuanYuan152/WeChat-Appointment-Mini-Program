import { roleLabel } from "@/lib/format";
import type { AdminUser, ApiMessage, CurrentUser, Role, UserBoardSummary } from "@/types/api";

export function getName(user: AdminUser | CurrentUser | UserBoardSummary | null | undefined) {
  if (!user) {
    return "-";
  }
  if ("name" in user && user.name) {
    return user.name;
  }
  if ("realName" in user && user.realName) {
    return user.realName;
  }
  if ("nickname" in user && user.nickname) {
    return user.nickname;
  }
  return user.mobile || "未留姓名用户";
}

export function getMessage(payload: unknown, fallback = "操作已完成") {
  if (payload && typeof payload === "object") {
    const message = (payload as ApiMessage).message || (payload as ApiMessage).msg;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export function roleText(rolesValue?: Role[]) {
  if (!rolesValue || rolesValue.length === 0) {
    return "未绑定角色";
  }
  return rolesValue.map(roleLabel).join(" / ");
}
