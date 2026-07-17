"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const score = i + 1;
        const filled = score <= value;
        return (
          <button
            key={score}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(score)}
            className={cn(
              "transition-colors",
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
            )}
            aria-label={`${score} 星`}
          >
            <Star
              className={cn(
                iconSize,
                filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
