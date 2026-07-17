"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchUnreadMessageCount } from "@/lib/booking/api";

export function useUnreadMessageCount() {
  const token = useAuthStore((s) => s.token);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const n = await fetchUnreadMessageCount(token);
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  return count;
}
