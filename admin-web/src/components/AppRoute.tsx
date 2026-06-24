"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useEffect } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter } from "next/navigation";

import { clearStoredToken, fetchCurrentUser, getStoredToken, loginWithDevCode } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import type { CurrentUser } from "@/types/api";

import { sectionPathById, sections } from "@/config/navigation";
import type { Notice, SectionId } from "@/types/app";
import { getMessage, roleText } from "@/lib/display";
import { AppShell } from "./AppShell";
import { LoginScreen } from "./LoginScreen";

interface AppRouteContextValue {
  currentUser: CurrentUser;
  isAdmin: boolean;
  refreshKey: number;
  setLoading: Dispatch<SetStateAction<boolean>>;
  showNotice: (type: Notice["type"], text: string) => void;
  clearNotice: () => void;
  requestRefresh: () => void;
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
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = currentUser?.roles.includes("Admin") ?? false;
  const canEnterAdmin = currentUser?.roles.some((role) => role === "Admin" || role === "Ops") ?? false;
  const section = sections.find((item) => item.id === sectionId);

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
  }, []);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const requestRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

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

  const handleLogin = async (code: "dev_admin" | "dev_ops") => {
    setLoading(true);
    clearNotice();
    try {
      await loginWithDevCode(code);
      const me = await fetchCurrentUser();
      setCurrentUser(me);
      showNotice("success", `已进入${roleLabel(me.activeRole)}开发账号`);
      router.replace(sectionPathById[sectionId]);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
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
      runAction,
    };
  }, [clearNotice, currentUser, isAdmin, refreshKey, requestRefresh, runAction, showNotice]);

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
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} />;
  }

  if (!canEnterAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--lxxl-border)] bg-white p-8">
          <h1 className="text-xl font-semibold">无法进入 Web 管理端</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
            当前账号是 {roleText(currentUser.roles)}，Web 第一版只开放管理员和运营角色。
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

  if (section?.adminOnly && !isAdmin) {
    return (
      <AppShell
        activeSection={sectionId}
        currentUser={currentUser}
        isAdmin={isAdmin}
        loading={loading}
        notice={notice}
        onChangeSection={(nextSection) => router.push(sectionPathById[nextSection])}
        onLogout={handleLogout}
        onRefresh={requestRefresh}
      >
        <section className="rounded-xl border border-[var(--lxxl-border)] bg-white p-8">
          <h2 className="text-lg font-semibold">没有访问权限</h2>
          <p className="mt-3 text-sm text-[var(--lxxl-muted)]">当前页面只允许管理员访问。</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppRouteContext.Provider value={contextValue}>
      <AppShell
        activeSection={sectionId}
        currentUser={currentUser}
        isAdmin={isAdmin}
        loading={loading}
        notice={notice}
        onChangeSection={(nextSection) => router.push(sectionPathById[nextSection])}
        onLogout={handleLogout}
        onRefresh={requestRefresh}
      >
        {children}
      </AppShell>
    </AppRouteContext.Provider>
  );
}
