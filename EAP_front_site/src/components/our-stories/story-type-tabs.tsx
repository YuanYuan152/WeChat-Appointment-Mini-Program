"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OurStoryType } from "@/lib/our-stories/utils";

interface StoryTypeTabsProps {
  active: "all" | OurStoryType;
}

export function StoryTypeTabs({ active }: StoryTypeTabsProps) {
  const tabs = [
    { key: "all" as const, label: "全部故事", href: "/our-stories" },
    { key: "visitor" as const, label: "来访故事", href: "/our-stories/visitor" },
    { key: "trainee" as const, label: "学员故事", href: "/our-stories/trainee" },
    { key: "counselor" as const, label: "咨询师手记", href: "/our-stories/counselor" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-full px-5 py-2 text-sm transition-colors",
            active === tab.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
