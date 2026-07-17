"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Consultant } from "@/lib/api/types";

interface ConsultantCardProps {
  consultant: Consultant;
  index?: number;
}

export function ConsultantCard({ consultant, index = 0 }: ConsultantCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <article className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all hover:shadow-lg">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-40">
            <Image
              src={consultant.avatar}
              alt={consultant.name}
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-lg font-semibold">{consultant.name}</h3>
                <p className="text-sm text-muted-foreground">{consultant.title}</p>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="font-medium">{consultant.rating}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {consultant.specialties.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>

            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
              {consultant.bio}
            </p>

            <div className="mt-auto flex items-center justify-between pt-4">
              <div>
                <span className="text-lg font-semibold text-primary">¥{consultant.price}</span>
                <span className="text-xs text-muted-foreground"> / 50分钟</span>
              </div>
              <Link href={`/consultation?id=${encodeURIComponent(consultant.id)}`}>
                <Button size="sm">预约咨询</Button>
              </Link>
            </div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}
