"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { OurStorySection } from "@/lib/api/types";

interface OurStorySectionViewProps {
  section: OurStorySection;
  index: number;
}

export function OurStorySectionView({ section, index }: OurStorySectionViewProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="mb-16"
    >
      <h2 className="mb-6 font-serif text-2xl font-semibold text-primary">
        {section.title}
      </h2>
      {section.image && (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-[var(--radius)]">
          <Image
            src={section.image}
            alt={section.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>
      )}
      <div className="prose prose-neutral max-w-none">
        {section.content.split("\n\n").map((paragraph, i) => (
          <p key={i} className="mb-4 text-base leading-relaxed text-foreground/85">
            {paragraph}
          </p>
        ))}
      </div>
    </motion.section>
  );
}
