"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CounselorListItem } from "@/lib/booking/types";
import { billingToYuan, splitCsv } from "@/lib/booking/utils";
import { resolveCounselorAvatar } from "@/lib/booking/counselor-avatars";
import { consultationDetailPath } from "@/lib/booking/paths";

interface CounselorCardProps {
  counselor: CounselorListItem;
  index?: number;
}

export function CounselorCard({ counselor, index = 0 }: CounselorCardProps) {
  const price = billingToYuan(counselor.billing);
  const specialties = splitCsv(counselor.specialty || counselor.field);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all hover:shadow-lg"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-44">
          <Image
            src={resolveCounselorAvatar(counselor.name, counselor.id)}
            alt={counselor.name}
            fill
            className="object-cover"
            sizes="176px"
          />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-semibold">{counselor.name}</h3>
              <p className="text-sm text-muted-foreground">
                {counselor.title || "心理咨询师"}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>从业 {counselor.workYears} 年</div>
              <div>{counselor.consultHours}h+ 咨询</div>
            </div>
          </div>

          {specialties.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {specialties.slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {counselor.introduce || "专业心理咨询服务"}
          </p>

          <div className="mt-auto flex items-center justify-between pt-4">
            <div>
              <span className="text-lg font-semibold text-primary">¥{price}</span>
              <span className="text-xs text-muted-foreground"> / 50分钟</span>
            </div>
            <Link href={consultationDetailPath(counselor.id, counselor._source)}>
              <Button size="sm">预约咨询</Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
