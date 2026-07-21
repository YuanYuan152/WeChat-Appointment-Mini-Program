"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

interface AssessmentAuthGateProps {
  children: React.ReactNode;
  /** 是否等待用户信息加载完成（保存报告等场景需要 user.id） */
  requireUser?: boolean;
}

export function AssessmentAuthGate({
  children,
  requireUser = false,
}: AssessmentAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useAuthStore.persist.hasHydrated()) {
      finish();
    }
    return useAuthStore.persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (requireUser && !user) {
      refreshUser();
    }
  }, [hydrated, token, user, requireUser, pathname, router, refreshUser]);

  if (!hydrated || !token || (requireUser && !user)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return <>{children}</>;
}

export function useRequireAssessmentLogin() {
  const router = useRouter();

  return (targetPath: string, onAuthed: () => void) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(targetPath)}`);
      return;
    }
    onAuthed();
  };
}
