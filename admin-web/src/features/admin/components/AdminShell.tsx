import type { ReactNode } from "react";

import { API_BASE_URL } from "@/lib/api";
import type { CurrentUser } from "@/types/api";

import { sections } from "../constants";
import type { Notice, SectionId } from "../types";
import { getName, roleText } from "../utils";

export function AdminShell({
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
  return (
    <main className="min-h-screen bg-[var(--lxxl-bg)] text-[var(--lxxl-text)]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-[var(--lxxl-border)] bg-white">
          <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
            <div className="text-lg font-semibold">连心心理</div>
            <div className="mt-1 text-sm text-[var(--lxxl-muted)]">Web 管理端</div>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {sections.map((section) => {
              const disabled = section.adminOnly && !isAdmin;
              return (
                <button
                  key={section.id}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    activeSection === section.id
                      ? "bg-[var(--lxxl-green)] text-white"
                      : "text-[var(--lxxl-text)] hover:bg-[#F4F1EB]"
                  } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeSection(section.id)}
                >
                  <span className="block text-sm font-medium">{section.label}</span>
                  <span
                    className={`mt-1 block text-xs ${
                      activeSection === section.id ? "text-white/75" : "text-[var(--lxxl-muted)]"
                    }`}
                  >
                    {section.desc}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--lxxl-border)] bg-white/95 px-8 backdrop-blur">
            <div>
              <div className="text-sm text-[var(--lxxl-muted)]">接口：{API_BASE_URL}</div>
              <h1 className="text-xl font-semibold">
                {sections.find((section) => section.id === activeSection)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <div className="font-medium">{getName(currentUser)}</div>
                <div className="text-xs text-[var(--lxxl-muted)]">{roleText(currentUser.roles)}</div>
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
