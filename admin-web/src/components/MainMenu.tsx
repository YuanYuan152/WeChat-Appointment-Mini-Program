"use client";

import { useEffect, useRef, useState } from "react";

import {
  canAccessSection,
  getNavigationGroupBySection,
  getSectionById,
  navigationGroups,
} from "@/config/navigation";
import type { CurrentUser } from "@/types/api";
import type { SectionId } from "@/types/app";

const EXPANDED_GROUPS_STORAGE_KEY = "lxxl-admin-web-main-menu-expanded-groups";
let cachedExpandedGroupIds: string[] | null = null;
let cachedMenuScrollTop = 0;

export function MainMenu({
  activeSection,
  currentUser,
  collapsed,
  unreadMessageCount = 0,
  onCollapsedChange,
  onChangeSection,
}: {
  activeSection: SectionId;
  currentUser: CurrentUser;
  collapsed: boolean;
  unreadMessageCount?: number | null;
  onCollapsedChange: (collapsed: boolean) => void;
  onChangeSection: (section: SectionId) => void;
}) {
  const activeGroupId = getNavigationGroupBySection(activeSection)?.id;
  const navRef = useRef<HTMLElement | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(
    () => cachedExpandedGroupIds ?? [],
  );
  const [expandedStateReady, setExpandedStateReady] = useState(cachedExpandedGroupIds !== null);

  useEffect(() => {
    if (cachedExpandedGroupIds) {
      setExpandedStateReady(true);
      return;
    }

    const storedExpandedGroupIds = readStoredExpandedGroupIds();
    cachedExpandedGroupIds = storedExpandedGroupIds;
    setExpandedGroupIds(storedExpandedGroupIds);
    setExpandedStateReady(true);
  }, []);

  useEffect(() => {
    if (!expandedStateReady) {
      return;
    }

    cachedExpandedGroupIds = expandedGroupIds;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(expandedGroupIds));
    }
  }, [expandedGroupIds, expandedStateReady]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }
    requestAnimationFrame(() => {
      nav.scrollTop = cachedMenuScrollTop;
    });
  }, []);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--lxxl-border)] bg-white transition-[width] duration-200 ${
        collapsed ? "w-28" : "w-72"
      }`}
    >
      <div
        className={`flex shrink-0 border-b border-[var(--lxxl-border)] px-3 py-4 ${
          collapsed ? "flex-col items-start gap-3" : "items-center justify-between gap-3"
        }`}
      >
        {collapsed ? (
          <div className="whitespace-nowrap text-sm font-semibold text-[var(--lxxl-text)]">连心心理</div>
        ) : (
          <div className="min-w-0 px-3">
            <div className="text-lg font-semibold">连心心理</div>
            <div className="mt-1 text-sm text-[var(--lxxl-muted)]">Web 管理端</div>
          </div>
        )}
        <button
          aria-label={collapsed ? "展开主菜单" : "收起主菜单"}
          className={`flex h-8 shrink-0 items-center text-[var(--lxxl-muted)] transition hover:text-[var(--lxxl-green)] ${
            collapsed ? "w-5 justify-start" : "w-8 justify-center"
          }`}
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <SidebarToggleIcon collapsed={collapsed} />
        </button>
      </div>

      <nav
        ref={navRef}
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-4 ${collapsed ? "px-3" : "px-3"}`}
        onScroll={(event) => {
          cachedMenuScrollTop = event.currentTarget.scrollTop;
        }}
      >
        {navigationGroups.map((group) => {
          const visibleSectionIds = group.sectionIds.filter((sectionId) =>
            canAccessSection(getSectionById(sectionId), currentUser.roles),
          );
          if (visibleSectionIds.length === 0) {
            return null;
          }
          const expanded = expandedGroupIds.includes(group.id);
          const groupActive = group.id === activeGroupId;
          const groupHasUnreadMessages = (unreadMessageCount ?? 0) > 0 && visibleSectionIds.includes("messages");

          return (
            <div key={group.id}>
              <button
                aria-expanded={expanded}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  groupActive ? "text-[var(--lxxl-green)]" : "text-[var(--lxxl-muted)]"
                } ${collapsed ? "justify-start" : "hover:bg-[#F4F1EB]"}`}
                title={group.label}
                type="button"
                onClick={() => {
                  if (collapsed) {
                    onCollapsedChange(false);
                    setExpandedGroupIds((current) =>
                      current.includes(group.id) ? current : [...current, group.id],
                    );
                    return;
                  }
                  toggleGroup(group.id);
                }}
              >
                <span className={`relative ${collapsed ? "whitespace-nowrap" : ""}`}>
                  {group.label}
                  {collapsed && groupHasUnreadMessages && <UnreadDot />}
                </span>
                {!collapsed && <ChevronIcon expanded={expanded} />}
              </button>

              {!collapsed && expanded && (
                <div className="mt-1 space-y-1">
                  {visibleSectionIds.map((sectionId) => {
                    const section = getSectionById(sectionId);
                    if (!section) {
                      return null;
                    }
                    const active = activeSection === section.id;

                    return (
                      <button
                        key={section.id}
                        className={`w-full rounded-xl px-4 py-3 text-left transition ${
                          active
                            ? "bg-[var(--lxxl-green)] text-white"
                            : "text-[var(--lxxl-text)] hover:bg-[#F4F1EB]"
                        }`}
                        title={section.label}
                        type="button"
                        onClick={() => onChangeSection(section.id)}
                      >
                        <span className="relative inline-block text-sm font-medium">
                          {section.label}
                          {section.id === "messages" && (unreadMessageCount ?? 0) > 0 && <UnreadDot />}
                        </span>
                        <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-[var(--lxxl-muted)]"}`}>
                          {section.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function UnreadDot() {
  return (
    <span
      aria-label="有未读消息"
      className="absolute -right-3 -top-1 h-2.5 w-2.5 rounded-full bg-[#D94A3A] ring-2 ring-white"
    />
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      <rect height="18" rx="2.5" width="18" x="3" y="3" />
      <path d="M9 3v18" />
      {collapsed ? (
        <>
          <path d="M13 12h5" />
          <path d="m16 9 3 3-3 3" />
        </>
      ) : (
        <>
          <path d="M18 12h-5" />
          <path d="m15 9-3 3 3 3" />
        </>
      )}
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function readStoredExpandedGroupIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const groupIds = new Set(navigationGroups.map((group) => group.id));
    return parsedValue.filter((value): value is string => typeof value === "string" && groupIds.has(value));
  } catch {
    return [];
  }
}
