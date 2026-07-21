"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { AccountMenuList } from "@/components/auth/account-menu-list";
import { getUserDisplayName } from "@/lib/account-menu";

interface UserAccountLinksProps {
  onNavigate?: () => void;
}

/** 移动端侧栏用户菜单 */
export function UserAccountLinks({ onNavigate }: UserAccountLinksProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = getUserDisplayName(user);

  return (
    <div className="space-y-1 border-t border-border pt-3">
      <Link
        href="/profile"
        className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
        onClick={onNavigate}
      >
        {displayName}
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          个人中心 →
        </span>
      </Link>
      <div className="px-2">
        <AccountMenuList onNavigate={onNavigate} />
      </div>
    </div>
  );
}
