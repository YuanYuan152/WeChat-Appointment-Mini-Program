"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/types/api";

import { getNavigationGroupBySection, getSectionById } from "@/config/navigation";
import type { Notice, SectionId } from "@/types/app";
import { getName } from "@/lib/display";
import { roleLabel } from "@/lib/format";
import { MainMenu } from "@/components/MainMenu";

export function AppShell({
  activeSection,
  currentUser,
  loading,
  notice,
  unreadMessageCount,
  breadcrumbTail,
  children,
  onChangeSection,
  onLogout,
  onRefresh,
}: {
  activeSection: SectionId;
  currentUser: CurrentUser;
  loading: boolean;
  notice: Notice | null;
  unreadMessageCount?: number | null;
  breadcrumbTail?: string | null;
  children: ReactNode;
  onChangeSection: (section: SectionId) => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  // 手机 / 平板（< lg）：主菜单收成抽屉，由页眉左侧的菜单按钮打开
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeGroup = getNavigationGroupBySection(activeSection);
  const activeSectionConfig = getSectionById(activeSection);
  const activeRoleText = roleLabel(
    currentUser.activeRole ||
      currentUser.roles.find(
        (role) => role === "Admin" || role === "Ops" || role === "Assistant" || role === "Counselor",
      ) ||
      currentUser.roles[0],
  );

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    // 旋转屏幕 / 拉宽窗口到桌面宽度时自动关闭抽屉
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [mobileMenuOpen]);

  return (
    <main className="min-h-screen bg-[var(--lxxl-bg)] text-[var(--lxxl-text)]">
      <div className="flex min-h-screen">
        <MainMenu
          activeSection={activeSection}
          collapsed={menuCollapsed}
          currentUser={currentUser}
          unreadMessageCount={unreadMessageCount}
          onChangeSection={onChangeSection}
          onCollapsedChange={setMenuCollapsed}
        />

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="主菜单">
            <button
              aria-label="关闭主菜单"
              className="lxxl-fade-in absolute inset-0 h-full w-full cursor-default bg-black/35"
              type="button"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="lxxl-drawer-in absolute inset-y-0 left-0 flex w-[min(86vw,320px)] shadow-[16px_0_40px_rgba(44,44,44,0.18)]">
              <MainMenu
                activeSection={activeSection}
                collapsed={false}
                currentUser={currentUser}
                unreadMessageCount={unreadMessageCount}
                variant="drawer"
                onChangeSection={(section) => {
                  setMobileMenuOpen(false);
                  onChangeSection(section);
                }}
                onClose={() => setMobileMenuOpen(false)}
                onCollapsedChange={() => undefined}
              />
            </div>
          </div>
        ) : null}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--lxxl-border)] bg-white/95 px-3 backdrop-blur sm:px-4 lg:h-16 lg:justify-end lg:px-8">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <button
                aria-expanded={mobileMenuOpen}
                aria-label="打开主菜单"
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--lxxl-border)] text-[var(--lxxl-text)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
                type="button"
                onClick={() => setMobileMenuOpen(true)}
              >
                <MenuIcon />
                {(unreadMessageCount ?? 0) > 0 && (
                  <span
                    aria-label="有未读消息"
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#D94A3A] ring-2 ring-white"
                  />
                )}
              </button>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{activeSectionConfig?.label || "管理端"}</div>
                <div className="truncate text-[11px] text-[var(--lxxl-muted)]">{activeGroup?.label || "连心心理"}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm lg:gap-3">
              <button
                className="max-w-[7.5rem] text-right transition hover:opacity-80 sm:max-w-none"
                type="button"
                onClick={() => onChangeSection("myProfile")}
              >
                <div className="truncate font-medium">{getName(currentUser)}</div>
                <div className="hidden truncate text-xs text-[var(--lxxl-muted)] sm:block">{activeRoleText}</div>
              </button>
              <button
                aria-label="刷新"
                className="rounded-xl border border-[var(--lxxl-border)] px-3 py-1.5 lg:px-4 lg:py-2"
                type="button"
                onClick={onRefresh}
              >
                刷新
              </button>
              <button
                className="rounded-xl bg-[var(--lxxl-green)] px-3 py-1.5 font-medium text-white lg:px-4 lg:py-2"
                type="button"
                onClick={onLogout}
              >
                退出
              </button>
            </div>
          </header>

          <div className="border-b border-[var(--lxxl-border)] bg-white px-4 py-2.5 lg:px-8 lg:py-3">
            <nav aria-label="面包屑" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
              <span className="text-[var(--lxxl-muted)]">{activeGroup?.label || "管理端"}</span>
              <span className="text-[var(--lxxl-muted)]">&gt;</span>
              <span className={breadcrumbTail ? "text-[var(--lxxl-muted)]" : "font-medium text-[var(--lxxl-text)]"}>
                {activeSectionConfig?.label || "当前页面"}
              </span>
              {breadcrumbTail ? (
                <>
                  <span className="text-[var(--lxxl-muted)]">&gt;</span>
                  <span className="min-w-0 break-all font-medium text-[var(--lxxl-text)]">{breadcrumbTail}</span>
                </>
              ) : null}
            </nav>
          </div>

          <div className="lxxl-content min-w-0 p-3 sm:p-5 lg:p-8">
            {notice && (
              <div
                role="alert"
                className={`fixed left-3 right-3 top-16 z-[70] rounded-xl border px-4 py-3 text-sm shadow-[0_16px_40px_rgba(44,44,44,0.18)] sm:left-auto sm:right-6 sm:top-20 sm:max-w-[min(420px,calc(100vw-3rem))] ${
                  notice.type === "error"
                    ? "border-[#F0B8B2] bg-[#FFF4F2] text-[#A13F37]"
                    : notice.type === "success"
                      ? "border-[#C9E4D4] bg-[#F1FAF4] text-[var(--lxxl-green-dark)]"
                      : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-text)]"
                }`}
              >
                {notice.text}
              </div>
            )}
            {loading && <div className="mb-5 text-sm text-[var(--lxxl-muted)]">正在处理...</div>}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
