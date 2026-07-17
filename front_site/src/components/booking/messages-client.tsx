"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { fetchMessages } from "@/lib/booking/api";
import type { MessageItem } from "@/lib/booking/types";
import {
  formatMessageTime,
  messageCategoryLabel,
  messageDisplayTitle,
  messageSummary,
  PATIENT_MESSAGE_CATEGORIES,
} from "@/lib/messages/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

export function MessagesClient() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchMessages(token, {
        category: activeCategory === "ALL" ? undefined : activeCategory,
      });
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [token, activeCategory]);

  useEffect(() => {
    if (!token) {
      router.replace("/login?redirect=/consultation/messages");
      return;
    }
    load();
  }, [token, load, router]);

  if (!token) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {PATIENT_MESSAGE_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              activeCategory === cat.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <p className="py-12 text-center text-muted-foreground">加载中…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">暂无消息</p>
          <Link href="/consultation" className="mt-4 inline-block text-primary hover:underline">
            去预约咨询
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((item) => (
          <Link
            key={item.id}
            href={`/consultation/messages/${item.id}`}
            className={cn(
              "flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4 transition-colors hover:border-primary/30",
              !item.isRead && "border-primary/20 bg-primary/5"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {messageCategoryLabel(item)}
                </span>
                {!item.isRead && <span className="h-2 w-2 rounded-full bg-red-500" />}
              </div>
              <h3 className="mt-2 font-medium">{messageDisplayTitle(item)}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {messageSummary(item)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatMessageTime(item.createdAt)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
