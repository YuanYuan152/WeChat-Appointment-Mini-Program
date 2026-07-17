"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StartAssessmentButton } from "@/components/assessment/start-assessment-button";
import { StartProfessionalAssessmentButton } from "@/components/assessment/professional-assessment-privacy";
import type { Assessment } from "@/lib/api/types";

interface AssessmentCardProps {
  assessment: Assessment;
  type: "professional" | "fun";
  index?: number;
}

export function AssessmentCard({ assessment, type, index = 0 }: AssessmentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <article className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all hover:shadow-lg">
        <div className="relative aspect-[2/1] overflow-hidden">
          <Image
            src={assessment.cover}
            alt={assessment.title}
            fill
            priority={index === 0}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
          <Badge
            variant={type === "professional" ? "default" : "accent"}
            className="absolute left-4 top-4"
          >
            {type === "professional" ? "专业量表" : "趣味探索"}
          </Badge>
        </div>
        <div className="p-5">
          <h3 className="font-serif text-lg font-semibold">{assessment.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{assessment.subtitle}</p>
          {assessment.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {assessment.description}
            </p>
          ) : null}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {assessment.questionCount} 题
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                约 {assessment.duration} 分钟
              </span>
            </div>
            {type === "professional" ? (
              <StartProfessionalAssessmentButton assessmentId={assessment.id} />
            ) : (
              <StartAssessmentButton assessmentId={assessment.id} type="fun" />
            )}
          </div>
        </div>
      </article>
    </motion.div>
  );
}
