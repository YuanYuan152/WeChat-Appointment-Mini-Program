"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AccessKeyGate } from "@/components/auth/access-key-gate";
import {
  getAccessKeyLoginDevCode,
  hasAccessKeyPassed,
  isAccessKeyLoginEnabled,
} from "@/lib/access-key-login";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AuthPageShell({
  type,
  redirectTo,
}: {
  type: "login" | "register";
  redirectTo?: string;
}) {
  const router = useRouter();
  const loginWithDevCode = useAuthStore((state) => state.loginWithDevCode);
  const token = useAuthStore((state) => state.token);
  const [accessKeyPassed, setAccessKeyPassed] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const autoLoginStartedRef = useRef(false);

  useEffect(() => {
    setAccessKeyPassed(hasAccessKeyPassed());
  }, []);

  useEffect(() => {
    if (token) {
      router.replace(redirectTo || "/");
      router.refresh();
    }
  }, [token, redirectTo, router]);

  useEffect(() => {
    if (!isAccessKeyLoginEnabled() || !accessKeyPassed || token || autoLoginStartedRef.current) {
      return;
    }
    let cancelled = false;
    autoLoginStartedRef.current = true;
    setAutoLoggingIn(true);
    setError("");
    void (async () => {
      try {
        await loginWithDevCode(getAccessKeyLoginDevCode());
        if (!cancelled) {
          router.replace(redirectTo || "/");
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          autoLoginStartedRef.current = false;
          setError(err instanceof Error ? err.message : "来访身份自动登录失败");
        }
      } finally {
        if (!cancelled) {
          setAutoLoggingIn(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessKeyPassed, loginWithDevCode, redirectTo, router, token]);

  if (!isAccessKeyLoginEnabled()) {
    return <AuthForm redirectTo={redirectTo} type={type} />;
  }

  if (!accessKeyPassed) {
    return <AccessKeyGate onUnlocked={() => setAccessKeyPassed(true)} />;
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        {autoLoggingIn ? "正在以来访身份登录..." : "正在进入站点..."}
      </p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
