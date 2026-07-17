"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Headphones, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactAssistantDialog } from "@/components/booking/contact-assistant-dialog";
import { useUnreadMessageCount } from "@/hooks/use-unread-message-count";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

export function ConsultationPortalToolbar() {
  const token = useAuthStore((s) => s.token);
  const unreadCount = useUnreadMessageCount();
  const [contactOpen, setContactOpen] = useState(false);

  const linkItems = [
    {
      href: "/consultation/records",
      label: "我的预约",
      icon: CalendarDays,
      requiresAuth: true,
    },
    {
      href: "/consultation/messages",
      label: "我的消息",
      icon: MessageSquare,
      requiresAuth: true,
      badge: unreadCount,
    },
  ];

  return (
    <>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {linkItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{item.label}</span>
              {"badge" in item && item.badge != null && item.badge > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </>
          );

          if (item.requiresAuth && !token) {
            return (
              <Link
                key={item.label}
                href={`/login?redirect=${encodeURIComponent(item.href)}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
                )}
              >
                {content}
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
              )}
            >
              {content}
            </Link>
          );
        })}

        <Button
          variant="outline"
          className="h-auto justify-start gap-3 rounded-xl px-4 py-3"
          onClick={() => setContactOpen(true)}
        >
          <Headphones className="h-5 w-5 text-primary" />
          <span className="font-medium">联系助理</span>
        </Button>
      </div>
      <ContactAssistantDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
}
