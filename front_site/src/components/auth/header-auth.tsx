"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { PreferenceTagsDialog } from "@/components/auth/preference-tags-dialog";
import { LogoutConfirmDialog } from "@/components/auth/logout-confirm-dialog";
import { UserMenu } from "@/components/auth/user-menu";

export function AuthHydrator() {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, [token, refreshUser]);

  return null;
}

export function AuthProvider() {
  return (
    <>
      <AuthHydrator />
      <PreferenceTagsDialog />
      <LogoutConfirmDialog />
    </>
  );
}

export function HeaderAuth() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">登录</Button>
        </Link>
        <Link href="/register">
          <Button size="sm">注册</Button>
        </Link>
      </div>
    );
  }

  return <UserMenu />;
}
