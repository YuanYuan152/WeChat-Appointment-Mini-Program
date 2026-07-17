"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenuList } from "@/components/auth/account-menu-list";
import { useLogoutConfirmStore } from "@/lib/stores/logout-confirm-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getUserDisplayName } from "@/lib/account-menu";
import { cn } from "@/lib/utils";

export function ProfileClient() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const openLogoutConfirm = useLogoutConfirmStore((s) => s.openLogoutConfirm);

  useEffect(() => {
    if (!token) {
      router.replace("/login?redirect=/profile");
    }
  }, [token, router]);

  if (!token) return null;

  const displayName = getUserDisplayName(user);
  const mobile = user?.mobile
    ? user.mobile.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
    : "未绑定";

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">手机号：{mobile}</p>
            {user?.activeRole && (
              <p className="mt-1 text-xs text-muted-foreground">
                当前角色：{user.activeRole}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-medium">我的服务</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            与小程序账号数据同步，可在此管理预约与消息
          </p>
        </div>
        <div className="p-3">
          <AccountMenuList showLogout={false} />
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-medium">账号设置</h3>
        </div>
        <div className="divide-y divide-border">
          <Link
            href="/consultation"
            className="flex items-center justify-between px-5 py-4 text-sm transition-colors hover:bg-muted/50"
          >
            <span>预约咨询</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          {user?.hasPreferenceTags === false && (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              偏好标签可在登录后弹窗中设置
            </p>
          )}
        </div>
      </section>

      <Button
        variant="outline"
        className={cn("w-full text-red-600 hover:bg-red-50 hover:text-red-700")}
        onClick={() => openLogoutConfirm(() => router.push("/"))}
      >
        退出登录
      </Button>
    </div>
  );
}
