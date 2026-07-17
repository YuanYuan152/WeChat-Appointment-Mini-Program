"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AssessmentQuestion } from "@/lib/api/types";

interface QuestionCardProps {
  question: AssessmentQuestion;
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  index: number;
}

export function QuestionCard({
  question,
  selectedOptionId,
  onSelect,
  index,
}: QuestionCardProps) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-2 text-sm text-muted-foreground">第 {index + 1} 题</div>
      <h2 className="mb-6 whitespace-pre-line font-serif text-xl font-semibold leading-relaxed sm:text-2xl">
        {question.text}
      </h2>
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={cn(
              "w-full rounded-xl border px-5 py-4 text-left text-sm transition-all",
              selectedOptionId === option.id
                ? "border-primary bg-primary/5 font-medium text-primary shadow-sm"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
