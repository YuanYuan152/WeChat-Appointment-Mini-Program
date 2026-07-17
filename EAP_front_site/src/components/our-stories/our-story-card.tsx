"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getOurStoryBadgeVariant,
  getOurStoryTypeLabel,
} from "@/lib/our-stories/utils";
import type { OurStory } from "@/lib/api/types";

interface OurStoryCardProps {
  story: OurStory;
  index?: number;
}

export function OurStoryCard({ story, index = 0 }: OurStoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link href={`/our-stories/${story.slug}`} className="group block">
        <article className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={story.cover}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
            <Badge
              variant={getOurStoryBadgeVariant(story.type)}
              className="absolute left-4 top-4"
            >
              {getOurStoryTypeLabel(story.type)}
            </Badge>
          </div>
          <div className="p-5">
            <h3 className="font-serif text-lg font-semibold group-hover:text-primary">
              {story.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{story.subtitle}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {story.excerpt}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {story.highlights.slice(0, 2).map((h) => (
                <Badge key={h} variant="outline" className="text-xs">{h}</Badge>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {story.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {story.readMinutes} 分钟
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
