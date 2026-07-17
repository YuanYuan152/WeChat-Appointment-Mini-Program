"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Phone } from "lucide-react";
import { ASSISTANT_CONTACT, CONTACT_CENTERS } from "@/lib/booking/contact-info";
import { cn } from "@/lib/utils";

interface ContactAssistantContentProps {
  showCenters?: boolean;
  compact?: boolean;
  className?: string;
}

export function ContactAssistantContent({
  showCenters = true,
  compact = false,
  className,
}: ContactAssistantContentProps) {
  const [qrFailed, setQrFailed] = useState(false);
  const assistant = ASSISTANT_CONTACT;

  return (
    <div className={cn("space-y-6", compact && "space-y-4", className)}>
      {showCenters && (
        <section className={cn("rounded-[var(--radius)] border border-border bg-card p-6", compact && "p-0 border-0 bg-transparent")}>
          <h3 className="mb-4 font-medium text-foreground">咨询中心地址</h3>
          <div className="space-y-4">
            {CONTACT_CENTERS.map((center) => (
              <div key={center.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <p className="font-medium">{center.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{center.address}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={cn("rounded-[var(--radius)] border border-border bg-card p-6", compact && "p-0 border-0 bg-transparent")}>
        <h3 className="mb-2 font-medium">助理微信二维码</h3>
        {assistant.hint && (
          <p className="mb-4 text-sm text-muted-foreground">{assistant.hint}</p>
        )}
        <div className="relative mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {!qrFailed ? (
            <Image
              src={assistant.qrcodeSrc}
              alt="咨询助理微信二维码"
              width={192}
              height={192}
              className="object-contain"
              onError={() => setQrFailed(true)}
            />
          ) : (
            <div className="px-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">二维码暂未配置</p>
              <p className="mt-1 text-xs text-muted-foreground">请致电助理或前往咨询中心</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          长按或扫码添加助理微信
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">{assistant.workHours}</p>
      </section>

      <section className={cn("rounded-[var(--radius)] border border-border bg-card p-6", compact && "p-0 border-0 bg-transparent")}>
        <h3 className="mb-3 font-medium">助理联系电话</h3>
        <a
          href={`tel:${assistant.phoneDial}`}
          className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-4 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-lg font-semibold text-primary">
            <Phone className="h-5 w-5" />
            {assistant.phone}
          </span>
          <span className="text-sm text-primary">点击拨打</span>
        </a>
        <p className="mt-2 text-xs text-muted-foreground">{assistant.workHours}</p>
      </section>
    </div>
  );
}
