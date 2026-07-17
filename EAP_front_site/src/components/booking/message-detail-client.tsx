"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMessageDetail, markMessageRead } from "@/lib/booking/api";
import type { MessageItem } from "@/lib/booking/types";
import {
  formatMessageTime,
  messageCategoryLabel,
  messageDisplayTitle,
  messageSummary,
  parseMessageContent,
  resolvePatientMessageLink,
} from "@/lib/messages/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

interface MessageDetailClientProps {
  messageId: number;
}

export function MessageDetailClient({ messageId }: MessageDetailClientProps) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [message, setMessage] = useState<MessageItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace(`/login?redirect=/consultation/messages/${messageId}`);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMessageDetail(token, messageId);
        if (!cancelled) setMessage(data);
        if (!data.isRead) {
          const updated = await markMessageRead(token, messageId);
          if (!cancelled) setMessage(updated);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, messageId, router]);

  if (!token) return null;

  const relatedLink = message ? resolvePatientMessageLink(message) : null;
  const detail = message ? parseMessageContent(message.content).detail : undefined;

  return (
    <div>
      <Link
        href="/consultation/messages"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回消息列表
      </Link>

      {loading && <p className="py-12 text-center text-muted-foreground">加载中…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {message && !loading && (
        <article className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {messageCategoryLabel(message)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold">
            {messageDisplayTitle(message)}
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {messageSummary(message)}
          </p>

          {detail && Object.keys(detail).length > 0 && (
            <div className="mt-6 space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              {typeof detail.counselorName === "string" && detail.counselorName && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">咨询师</span>
                  <span>{detail.counselorName}</span>
                </div>
              )}
              {typeof detail.startTime === "string" && detail.startTime && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">咨询时间</span>
                  <span>{detail.startTime}</span>
                </div>
              )}
              {(typeof detail.centerName === "string" && detail.centerName) ||
              (typeof detail.location === "string" && detail.location) ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">咨询地点</span>
                  <span>
                    {typeof detail.centerName === "string"
                      ? detail.centerName
                      : String(detail.location)}
                  </span>
                </div>
              ) : null}
              {typeof detail.activityTitle === "string" && detail.activityTitle && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">活动</span>
                  <span>{detail.activityTitle}</span>
                </div>
              )}
            </div>
          )}

          {relatedLink && (
            <div className="mt-6">
              <Link href={relatedLink}>
                <Button variant="outline">
                  {message.relatedType === "PATIENT_PROXY_ORDER_PENDING" ? "去支付" : "查看我的预约"}
                </Button>
              </Link>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
