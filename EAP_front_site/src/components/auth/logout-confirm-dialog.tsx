"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogoutConfirmStore } from "@/lib/stores/logout-confirm-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useQuizSession } from "@/lib/stores/quiz-session";

export function LogoutConfirmDialog() {
  const open = useLogoutConfirmStore((s) => s.open);
  const onConfirm = useLogoutConfirmStore((s) => s.onConfirm);
  const closeLogoutConfirm = useLogoutConfirmStore((s) => s.closeLogoutConfirm);
  const logout = useAuthStore((s) => s.logout);
  const clearAllQuizSessions = useQuizSession((s) => s.clearAllSessions);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogoutConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeLogoutConfirm]);

  if (!open || typeof document === "undefined") return null;

  const handleConfirm = () => {
    closeLogoutConfirm();
    clearAllQuizSessions();
    logout();
    onConfirm?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="关闭"
        onClick={closeLogoutConfirm}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        className="relative w-full max-w-[360px] animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <LogOut className="h-6 w-6" />
          </div>
          <h2 id="logout-dialog-title" className="text-lg font-semibold text-foreground">
            确认退出登录？
          </h2>
          <p id="logout-dialog-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
            退出后需重新登录，才能继续使用预约、消息等服务。
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-11" onClick={closeLogoutConfirm}>
            再想想
          </Button>
          <Button
            className="h-11 bg-red-600 text-white hover:bg-red-700"
            onClick={handleConfirm}
          >
            退出登录
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
