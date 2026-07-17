"use client";

import Link from "next/link";
import { useUnreadMessageCount } from "@/hooks/use-unread-message-count";
import { useLogoutConfirmStore } from "@/lib/stores/logout-confirm-store";
import {
  ACCOUNT_MENU_ITEMS,
  LOGOUT_MENU_ITEM,
  type AccountMenuItem,
} from "@/lib/account-menu";
import { cn } from "@/lib/utils";

interface AccountMenuListProps {
  onNavigate?: () => void;
  className?: string;
  itemClassName?: string;
  showLogout?: boolean;
}

export function AccountMenuList({
  onNavigate,
  className,
  itemClassName,
  showLogout = true,
}: AccountMenuListProps) {
  const openLogoutConfirm = useLogoutConfirmStore((s) => s.openLogoutConfirm);
  const unreadCount = useUnreadMessageCount();

  const renderItem = (item: AccountMenuItem) => {
    const Icon = item.icon;
    const badge =
      item.showBadge && unreadCount > 0 ? (
        <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null;

    const classes = cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
      item.variant === "danger"
        ? "text-red-600 hover:bg-red-50"
        : "text-foreground hover:bg-muted",
      itemClassName
    );

    if (item.id === "logout" || !item.href) {
      return (
        <button
          key={item.id}
          type="button"
          className={classes}
          onClick={() => {
            onNavigate?.();
            openLogoutConfirm();
          }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        className={classes}
        onClick={onNavigate}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {badge}
      </Link>
    );
  };

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {ACCOUNT_MENU_ITEMS.map(renderItem)}
      {showLogout && (
        <>
          <div className="my-1 h-px bg-border" />
          {renderItem(LOGOUT_MENU_ITEM)}
        </>
      )}
    </div>
  );
}
