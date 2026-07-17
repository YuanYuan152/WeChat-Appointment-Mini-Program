"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Story } from "@/lib/api/types";

interface StoryCardProps {
  story: Story;
  index?: number;
}

export function StoryCard({ story, index = 0 }: StoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link href={`/stories/${story.slug}`} className="group block">
        <article className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={story.cover}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
          </div>
          <div className="p-5">
            <div className="mb-2 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
            </div>
            <h3 className="font-serif text-lg font-semibold group-hover:text-primary">
              {story.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {story.excerpt}
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{story.readMinutes} 分钟阅读</span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
