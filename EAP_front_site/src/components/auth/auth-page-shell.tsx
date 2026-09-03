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

type LoginMode = "sms" | "access-key";

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
  const [loginMode, setLoginMode] = useState<LoginMode>("sms");
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
    if (
      !isAccessKeyLoginEnabled()
      || loginMode !== "access-key"
      || !accessKeyPassed
      || token
      || autoLoginStartedRef.current
    ) {
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
  }, [accessKeyPassed, loginMode, loginWithDevCode, redirectTo, router, token]);

  if (loginMode === "access-key" && isAccessKeyLoginEnabled() && !accessKeyPassed) {
    return (
      <AccessKeyGate
        onBackToSms={() => {
          setLoginMode("sms");
          setError("");
        }}
        onUnlocked={() => setAccessKeyPassed(true)}
      />
    );
  }

  if (loginMode === "access-key" && isAccessKeyLoginEnabled() && accessKeyPassed) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          {autoLoggingIn ? "正在以来访身份登录..." : "正在进入站点..."}
        </p>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        {error ? (
          <button
            className="mt-4 text-xs text-muted-foreground opacity-70 transition hover:opacity-100"
            type="button"
            onClick={() => {
              setLoginMode("sms");
              setAccessKeyPassed(false);
              autoLoginStartedRef.current = false;
              setError("");
            }}
          >
            返回短信登录
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <AuthForm
      redirectTo={redirectTo}
      showAccessKeyLink={isAccessKeyLoginEnabled()}
      type={type}
      onSwitchToAccessKey={() => {
        setLoginMode("access-key");
        setError("");
      }}
    />
  );
}
