"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

let nextDrawerId = 0;
const activeDrawerIds: number[] = [];
let openDrawerCount = 0;
let originalBodyOverflow = "";

export function DetailDrawer({
  title,
  children,
  onClose,
  footer,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode | null;
  closeDisabled?: boolean;
}) {
  const [drawerId] = useState(() => {
    nextDrawerId += 1;
    return nextDrawerId;
  });
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  }, [closeDisabled, onClose]);

  useEffect(() => {
    activeDrawerIds.push(drawerId);
    if (openDrawerCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDrawerCount += 1;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        closeDisabledRef.current ||
        activeDrawerIds.at(-1) !== drawerId
      ) {
        return;
      }
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const drawerIndex = activeDrawerIds.lastIndexOf(drawerId);
      if (drawerIndex >= 0) {
        activeDrawerIds.splice(drawerIndex, 1);
      }
      openDrawerCount = Math.max(0, openDrawerCount - 1);
      if (openDrawerCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
      }
    };
  }, [drawerId]);

  const resolvedFooter =
    footer === undefined ? (
      <button
        className="rounded-xl border border-[var(--lxxl-border)] px-4 py-2 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
        type="button"
        disabled={closeDisabled}
        onClick={onClose}
      >
        关闭
      </button>
    ) : (
      footer
    );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={(event) => {
        if (
          !closeDisabled &&
          event.target === event.currentTarget &&
          activeDrawerIds.at(-1) === drawerId
        ) {
          onClose();
        }
      }}
    >
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex h-full w-full max-w-[520px] flex-col border-l border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--lxxl-border)] px-6 py-4">
          <h3 id={titleId} className="min-w-0 text-lg font-semibold">
            {title}
          </h3>
          <button
            aria-label="关闭"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-2xl leading-none text-[var(--lxxl-muted)] transition hover:bg-[#FAF8F4] hover:text-[var(--lxxl-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={closeDisabled}
            title="关闭"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">{children}</div>
        {resolvedFooter !== null && (
          <div className="flex justify-start border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
            {resolvedFooter}
          </div>
        )}
      </aside>
    </div>
  );
}
