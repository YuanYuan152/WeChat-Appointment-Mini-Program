"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { User } from "lucide-react";
import { AccountMenuList } from "@/components/auth/account-menu-list";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getUserDisplayName } from "@/lib/account-menu";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = getUserDisplayName(user);

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <button
          type="button"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card transition-colors",
            open ? "border-primary/40 bg-primary/5 text-primary" : "text-muted-foreground hover:border-primary/30 hover:text-primary"
          )}
          aria-label="用户菜单"
          aria-expanded={open}
        >
          <User className="h-4 w-4" />
        </button>

        <div
          className={cn(
            "absolute right-0 top-full z-50 pt-2 transition-all duration-150",
            open
              ? "pointer-events-auto visible translate-y-0 opacity-100"
              : "pointer-events-none invisible -translate-y-1 opacity-0"
          )}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="min-w-[200px] rounded-xl border border-border bg-background p-2 shadow-lg">
            <AccountMenuList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>

      <Link
        href="/profile"
        className="max-w-[140px] truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
        title={displayName}
      >
        {displayName}
      </Link>
    </div>
  );
}
