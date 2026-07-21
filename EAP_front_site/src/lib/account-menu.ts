import {
  CalendarDays,
  Headphones,
  LogOut,
  MessageSquare,
  ClipboardList,
  User,
  type LucideIcon,
} from "lucide-react";

export interface AccountMenuItem {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  showBadge?: boolean;
  variant?: "default" | "danger";
}

export const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  {
    id: "records",
    label: "我的预约",
    href: "/consultation/records",
    icon: CalendarDays,
  },
  {
    id: "messages",
    label: "我的消息",
    href: "/consultation/messages",
    icon: MessageSquare,
    showBadge: true,
  },
  {
    id: "contact",
    label: "联系助理",
    href: "/consultation/contact",
    icon: Headphones,
  },
  {
    id: "assessment",
    label: "我的测评",
    href: "/assessment/reports",
    icon: ClipboardList,
  },
];

export const PROFILE_MENU_ITEM: AccountMenuItem = {
  id: "profile",
  label: "个人中心",
  href: "/profile",
  icon: User,
};

export const LOGOUT_MENU_ITEM: AccountMenuItem = {
  id: "logout",
  label: "退出登录",
  icon: LogOut,
  variant: "danger",
};

export function getUserDisplayName(
  user?: { nickname?: string | null; mobile?: string | null } | null
): string {
  return user?.nickname || user?.mobile || "用户";
}
