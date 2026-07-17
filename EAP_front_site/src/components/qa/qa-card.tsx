"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MessageCircleQuestion, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QaItem } from "@/lib/api/types";

interface QaCardProps {
  item: QaItem;
  index?: number;
}

export function QaCard({ item, index = 0 }: QaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Link href={`/qa/${item.slug}`} className="group block">
        <article className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.category}</Badge>
            {item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>

          <h3 className="flex items-start gap-2 font-serif text-lg font-semibold leading-snug group-hover:text-primary">
            <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            {item.question}
          </h3>

          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {item.excerpt}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full">
                <Image
                  src={item.counselorAvatar}
                  alt={item.counselorName}
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              </div>
              <div>
                <p className="text-sm font-medium">{item.counselorName}</p>
                <p className="text-xs text-muted-foreground">{item.counselorTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              {item.helpfulCount} 人觉得有帮助
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
