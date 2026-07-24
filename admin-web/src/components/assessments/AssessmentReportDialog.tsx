"use client";

import { useEffect, useId, useRef } from "react";

import { AssessmentReportView } from "@/components/assessments/AssessmentReportView";
import type {
  AssessmentReportDetail,
  AssessmentReportListItem,
} from "@/types/assessmentReport";

export function AssessmentReportDialog({
  loading,
  target,
  detail,
  onClose,
}: {
  loading: boolean;
  target?: AssessmentReportListItem;
  detail?: AssessmentReportDetail;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements.at(-1) || first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-5 sm:px-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-[#F7F5F1] shadow-2xl"
        role="dialog"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--lxxl-border)] bg-white px-6 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-lg font-semibold">
              {detail?.assessmentTitle ||
                target?.assessmentTitle ||
                "量表报告详情"}
            </h3>
            <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
              {detail?.patientName || target?.patientName || "正在读取报告"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="关闭量表报告"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-2xl leading-none text-[var(--lxxl-muted)] transition hover:bg-[#FAF8F4] hover:text-[var(--lxxl-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lxxl-green)]"
            title="关闭"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading && !detail ? (
            <div className="grid min-h-72 place-items-center text-sm text-[var(--lxxl-muted)]">
              正在加载报告详情...
            </div>
          ) : detail ? (
            <AssessmentReportView detail={detail} />
          ) : (
            <div className="grid min-h-72 place-items-center text-sm text-[var(--lxxl-muted)]">
              报告详情暂不可用。
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
          <button
            className="h-10 rounded-xl border border-[var(--lxxl-border)] bg-white px-5 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
            type="button"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}
