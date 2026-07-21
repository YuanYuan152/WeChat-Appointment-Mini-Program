"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  fetchMe,
  loginWithCode,
  loginWithPassword,
  registerWithCode,
  registerWithPassword,
  type AuthUser,
} from "@/lib/api/auth";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  loginByCode: (phone: string, code: string) => Promise<void>;
  loginByPassword: (phone: string, password: string) => Promise<void>;
  registerByCode: (phone: string, code: string, password?: string) => Promise<void>;
  registerByPassword: (phone: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,

      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),

      loginByCode: async (phone, code) => {
        set({ loading: true });
        try {
          const { token } = await loginWithCode(phone, code);
          set({ token });
          await get().refreshUser();
        } finally {
          set({ loading: false });
        }
      },

      loginByPassword: async (phone, password) => {
        set({ loading: true });
        try {
          const { token } = await loginWithPassword(phone, password);
          set({ token });
          await get().refreshUser();
        } finally {
          set({ loading: false });
        }
      },

      registerByCode: async (phone, code, password) => {
        set({ loading: true });
        try {
          const { token } = await registerWithCode(phone, code, password);
          set({ token });
          await get().refreshUser();
        } finally {
          set({ loading: false });
        }
      },

      registerByPassword: async (phone, password) => {
        set({ loading: true });
        try {
          const { token } = await registerWithPassword(phone, password);
          set({ token });
          await get().refreshUser();
        } finally {
          set({ loading: false });
        }
      },

      refreshUser: async () => {
        const token = get().token;
        if (!token) {
          set({ user: null });
          return;
        }
        try {
          const user = await fetchMe(token);
          set({ user });
        } catch {
          set({ token: null, user: null });
        }
      },

      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token }),
    }
  )
);
