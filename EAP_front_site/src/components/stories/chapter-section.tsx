"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { StoryChapter } from "@/lib/api/types";

interface ChapterSectionProps {
  chapter: StoryChapter;
  index: number;
}

export function ChapterSection({ chapter, index }: ChapterSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="mb-16"
    >
      <h2 className="mb-6 font-serif text-2xl font-semibold text-primary">
        {chapter.title}
      </h2>
      {chapter.image && (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-[var(--radius)]">
          <Image
            src={chapter.image}
            alt={chapter.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      )}
      <div className="prose prose-neutral max-w-none">
        {chapter.content.split("\n\n").map((paragraph, i) => (
          <p key={i} className="mb-4 text-base leading-relaxed text-foreground/85">
            {paragraph}
          </p>
        ))}
      </div>
    </motion.section>
  );
}
