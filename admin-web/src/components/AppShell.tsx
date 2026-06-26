"use client";

import { useState } from "react";
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
  isAdmin,
  loading,
  notice,
  children,
  onChangeSection,
  onLogout,
  onRefresh,
}: {
  activeSection: SectionId;
  currentUser: CurrentUser;
  isAdmin: boolean;
  loading: boolean;
  notice: Notice | null;
  children: ReactNode;
  onChangeSection: (section: SectionId) => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const activeGroup = getNavigationGroupBySection(activeSection);
  const activeSectionConfig = getSectionById(activeSection);
  const activeRoleText = roleLabel(
    currentUser.activeRole || currentUser.roles.find((role) => role === "Admin" || role === "Ops") || currentUser.roles[0],
  );

  return (
    <main className="min-h-screen bg-[var(--lxxl-bg)] text-[var(--lxxl-text)]">
      <div className="flex min-h-screen">
        <MainMenu
          activeSection={activeSection}
          collapsed={menuCollapsed}
          isAdmin={isAdmin}
          onChangeSection={onChangeSection}
          onCollapsedChange={setMenuCollapsed}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b border-[var(--lxxl-border)] bg-white/95 px-8 backdrop-blur">
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <div className="font-medium">{getName(currentUser)}</div>
                <div className="text-xs text-[var(--lxxl-muted)]">{activeRoleText}</div>
              </div>
              <button
                className="rounded-xl border border-[var(--lxxl-border)] px-4 py-2"
                type="button"
                onClick={onRefresh}
              >
                刷新
              </button>
              <button
                className="rounded-xl bg-[var(--lxxl-green)] px-4 py-2 font-medium text-white"
                type="button"
                onClick={onLogout}
              >
                退出
              </button>
            </div>
          </header>

          <div className="border-b border-[var(--lxxl-border)] bg-white px-8 py-3">
            <nav aria-label="面包屑" className="flex items-center gap-2 text-sm">
              <span className="text-[var(--lxxl-muted)]">{activeGroup?.label || "管理端"}</span>
              <span className="text-[var(--lxxl-muted)]">&gt;</span>
              <span className="font-medium text-[var(--lxxl-text)]">
                {activeSectionConfig?.label || "当前页面"}
              </span>
            </nav>
          </div>

          <div className="p-8">
            {notice && (
              <div
                className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
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
