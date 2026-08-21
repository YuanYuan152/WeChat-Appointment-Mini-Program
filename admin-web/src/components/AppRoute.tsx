"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter } from "next/navigation";

import type { DevLoginCode } from "@/lib/api";
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearStoredToken,
  fetchCurrentUser,
  getStoredToken,
  loginWithDevCode,
} from "@/lib/api";
import { roleLabel } from "@/lib/format";
import {
  clearAccessKeyPassed,
  getAccessKeyLoginDevCode,
  hasAccessKeyPassed,
  isAccessKeyLoginEnabled,
} from "@/lib/accessKeyLogin";
import type { CurrentUser } from "@/types/api";

import { canAccessSection, getDefaultSectionId, sectionPathById, sections } from "@/config/navigation";
import type { Notice, SectionId } from "@/types/app";
import { getMessage, roleText } from "@/lib/display";
import { AppShell } from "./AppShell";
import { AccessKeyGateScreen } from "./AccessKeyGateScreen";
import { LoginScreen } from "./LoginScreen";
import { fetchUnreadMessageCount, MESSAGE_UNREAD_CHANGED_EVENT } from "@/services/messages";

interface AppRouteContextValue {
  currentUser: CurrentUser;
  isAdmin: boolean;
  refreshKey: number;
  setLoading: Dispatch<SetStateAction<boolean>>;
  showNotice: (type: Notice["type"], text: string) => void;
  clearNotice: () => void;
  requestRefresh: () => void;
  refreshCurrentUser: () => Promise<CurrentUser>;
  runAction: (action: () => Promise<unknown>, successFallback: string) => Promise<void>;
}

const AppRouteContext = createContext<AppRouteContextValue | null>(null);

export function useAppRoute() {
  const context = useContext(AppRouteContext);
  if (!context) {
    throw new Error("useAppRoute must be used inside AppRoute");
  }
  return context;
}

export function AppRoute({ sectionId, children }: { sectionId: SectionId; children: ReactNode }) {
  const existingContext = useContext(AppRouteContext);
  if (existingContext) {
    return <>{children}</>;
  }

  return <AppRouteRoot sectionId={sectionId}>{children}</AppRouteRoot>;
}

function AppRouteRoot({ sectionId, children }: { sectionId: SectionId; children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number | null>(null);
  const [accessKeyPassed, setAccessKeyPassed] = useState(false);
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
  const accessKeyLoginEnabled = isAccessKeyLoginEnabled();
  const autoLoginStartedRef = useRef(false);

  const isAdmin = currentUser?.roles.includes("Admin") ?? false;
  const canEnterWeb =
    currentUser?.roles.some((role) => role === "Admin" || role === "Ops" || role === "Assistant" || role === "Counselor") ??
    false;
  const section = sections.find((item) => item.id === sectionId);

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
  }, []);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  useEffect(() => {
    setAccessKeyPassed(hasAccessKeyPassed());
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), notice.type === "error" ? 4000 : 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const requestRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const me = await fetchCurrentUser();
    setCurrentUser(me);
    return me;
  }, []);

  const refreshUnreadMessageCount = useCallback(async () => {
    if (!currentUser) {
      setUnreadMessageCount(null);
      return;
    }
    try {
      const result = await fetchUnreadMessageCount();
      setUnreadMessageCount(result.count || 0);
    } catch {
      // 保留最近一次成功读取的数量，避免接口失败时把未读消息误显示为 0。
    }
  }, [currentUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setUnreadMessageCount(null);
      setLoading(false);
      setBooting(false);
      autoLoginStartedRef.current = false;
      if (accessKeyLoginEnabled) {
        clearAccessKeyPassed();
        setAccessKeyPassed(false);
      }
      setAutoLoginError(null);
      clearNotice();
      router.replace("/login");
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [accessKeyLoginEnabled, clearNotice, router]);

  useEffect(() => {
    async function boot() {
      const token = getStoredToken();
      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const me = await fetchCurrentUser();
        setCurrentUser(me);
      } catch {
        clearStoredToken();
      } finally {
        setBooting(false);
      }
    }

    void boot();
  }, []);

  useEffect(() => {
    void refreshUnreadMessageCount();
  }, [refreshKey, refreshUnreadMessageCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener(MESSAGE_UNREAD_CHANGED_EVENT, refreshUnreadMessageCount);
    return () => {
      window.removeEventListener(MESSAGE_UNREAD_CHANGED_EVENT, refreshUnreadMessageCount);
    };
  }, [refreshUnreadMessageCount]);

  const handleLogin = async (code: DevLoginCode) => {
    setLoading(true);
    clearNotice();
    setAutoLoginError(null);
    try {
      await loginWithDevCode(code);
      const me = await fetchCurrentUser();
      setUnreadMessageCount(null);
      setCurrentUser(me);
      showNotice("success", `已进入${roleLabel(me.activeRole)}`);
      router.replace(sectionPathById[getDefaultSectionId(me.roles)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setAutoLoginError(message);
      showNotice("error", message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      booting
      || loading
      || currentUser
      || !accessKeyLoginEnabled
      || !accessKeyPassed
      || autoLoginStartedRef.current
    ) {
      return;
    }

    autoLoginStartedRef.current = true;
    void handleLogin(getAccessKeyLoginDevCode() as DevLoginCode).catch(() => {
      // 错误已在 handleLogin 中展示；需手动点「重试登录」。
    });
  }, [accessKeyLoginEnabled, accessKeyPassed, booting, currentUser, loading]);

  const handleLogout = () => {
    clearStoredToken();
    autoLoginStartedRef.current = false;
    if (accessKeyLoginEnabled) {
      clearAccessKeyPassed();
      setAccessKeyPassed(false);
    }
    setAutoLoginError(null);
    setCurrentUser(null);
    setUnreadMessageCount(null);
    clearNotice();
    router.replace("/login");
  };

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successFallback: string) => {
      setLoading(true);
      try {
        const result = await action();
        showNotice("success", getMessage(result, successFallback));
        requestRefresh();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "操作失败");
      } finally {
        setLoading(false);
      }
    },
    [requestRefresh, showNotice],
  );

  const contextValue = useMemo<AppRouteContextValue | null>(() => {
    if (!currentUser) {
      return null;
    }
    return {
      currentUser,
      isAdmin,
      refreshKey,
      setLoading,
      showNotice,
      clearNotice,
      requestRefresh,
      refreshCurrentUser,
      runAction,
    };
  }, [clearNotice, currentUser, isAdmin, refreshCurrentUser, refreshKey, requestRefresh, runAction, showNotice]);

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] text-[var(--lxxl-text)]">
        <div className="rounded-2xl border border-[var(--lxxl-border)] bg-white px-8 py-6 text-sm text-[var(--lxxl-muted)]">
          正在恢复登录状态...
        </div>
      </main>
    );
  }

  if (!currentUser || !contextValue) {
    if (accessKeyLoginEnabled && !accessKeyPassed) {
      return (
        <AccessKeyGateScreen
          notice={notice}
          onUnlocked={() => setAccessKeyPassed(true)}
        />
      );
    }
    if (accessKeyLoginEnabled) {
      const statusText = loading
        ? "正在以管理员身份登录..."
        : autoLoginError || "正在以管理员身份登录...";
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
          <section className="w-full max-w-md rounded-2xl border border-[var(--lxxl-border)] bg-white px-8 py-6">
            <p className="text-sm text-[var(--lxxl-muted)]">{statusText}</p>
            {!loading && autoLoginError ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={loading}
                  type="button"
                  onClick={() => {
                    autoLoginStartedRef.current = true;
                    void handleLogin(getAccessKeyLoginDevCode() as DevLoginCode).catch(() => {
                      // 错误已写入 autoLoginError。
                    });
                  }}
                >
                  重试登录
                </button>
                <button
                  className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm text-[var(--lxxl-text)]"
                  disabled={loading}
                  type="button"
                  onClick={() => {
                    clearAccessKeyPassed();
                    setAccessKeyPassed(false);
                    autoLoginStartedRef.current = false;
                    setAutoLoginError(null);
                    clearNotice();
                  }}
                >
                  重新输入密钥
                </button>
              </div>
            ) : null}
          </section>
        </main>
      );
    }
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} />;
  }

  if (!canEnterWeb) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--lxxl-border)] bg-white p-8">
          <h1 className="text-xl font-semibold">无法进入 Web 管理端</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
            当前账号是 {roleText(currentUser.roles)}，仅管理员、咨询主任、咨询助理和咨询师角色可以进入。
          </p>
          <button
            className="mt-6 rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white"
            type="button"
            onClick={handleLogout}
          >
            退出
          </button>
        </section>
      </main>
    );
  }

  if (!canAccessSection(section, currentUser.roles)) {
    return (
      <AppShell
        activeSection={sectionId}
        currentUser={currentUser}
        loading={loading}
        notice={notice}
        unreadMessageCount={unreadMessageCount}
        onChangeSection={(nextSection) => router.push(sectionPathById[nextSection])}
        onLogout={handleLogout}
        onRefresh={requestRefresh}
      >
        <section className="rounded-xl border border-[var(--lxxl-border)] bg-white p-8">
          <h2 className="text-lg font-semibold">没有访问权限</h2>
          <p className="mt-3 text-sm text-[var(--lxxl-muted)]">当前角色不能访问这个页面。</p>
          <button
            className="mt-5 rounded-xl bg-[var(--lxxl-green)] px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={() => router.replace(sectionPathById[getDefaultSectionId(currentUser.roles)])}
          >
            回到工作台
          </button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppRouteContext.Provider value={contextValue}>
      <AppShell
        activeSection={sectionId}
        currentUser={currentUser}
        loading={loading}
        notice={notice}
        unreadMessageCount={unreadMessageCount}
        onChangeSection={(nextSection) => router.push(sectionPathById[nextSection])}
        onLogout={handleLogout}
        onRefresh={requestRefresh}
      >
        {children}
      </AppShell>
    </AppRouteContext.Provider>
  );
}
