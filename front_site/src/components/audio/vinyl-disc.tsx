"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface VinylDiscProps {
  cover: string;
  isPlaying: boolean;
  size?: "sm" | "lg";
}

export function VinylDisc({ cover, isPlaying, size = "lg" }: VinylDiscProps) {
  const sizeClass = size === "lg" ? "h-64 w-64 sm:h-80 sm:w-80" : "h-16 w-16";

  return (
    <div className={cn("relative", sizeClass)}>
      <div
        className={cn(
          "vinyl-spin relative h-full w-full rounded-full shadow-2xl",
          isPlaying && "playing"
        )}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
        <div className="absolute inset-[3%] rounded-full border border-neutral-700/50" />
        <div className="absolute inset-[8%] rounded-full border border-neutral-600/30" />
        <div className="absolute inset-[15%] rounded-full border border-neutral-600/20" />
        <div className="absolute inset-[22%] overflow-hidden rounded-full">
          <Image src={cover} alt="封面" fill className="object-cover" sizes="320px" />
        </div>
        <div className="absolute left-1/2 top-1/2 z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900 ring-2 ring-neutral-700" />
        <div className="absolute left-1/2 top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600" />
      </div>
      {size === "lg" && (
        <div className="absolute -right-4 top-8 h-32 w-3 origin-top rotate-[25deg] rounded-full bg-gradient-to-b from-neutral-400 to-neutral-600 shadow-md" />
      )}
    </div>
  );
}
