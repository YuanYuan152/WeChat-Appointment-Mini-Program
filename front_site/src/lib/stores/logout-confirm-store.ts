"use client";

import { create } from "zustand";

interface LogoutConfirmState {
  open: boolean;
  onConfirm?: () => void;
  openLogoutConfirm: (onConfirm?: () => void) => void;
  closeLogoutConfirm: () => void;
}

export const useLogoutConfirmStore = create<LogoutConfirmState>((set) => ({
  open: false,
  onConfirm: undefined,
  openLogoutConfirm: (onConfirm) => set({ open: true, onConfirm }),
  closeLogoutConfirm: () => set({ open: false, onConfirm: undefined }),
}));
