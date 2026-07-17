import type { OurStory } from "@/lib/api/types";

export type OurStoryType = OurStory["type"];

export function getOurStoryTypeLabel(type: OurStoryType): string {
  const labels: Record<OurStoryType, string> = {
    visitor: "来访故事",
    trainee: "学员故事",
    counselor: "咨询师手记",
  };
  return labels[type];
}

export function getOurStoryListHref(type: OurStoryType): string {
  return `/our-stories/${type}`;
}

export function getOurStoryBadgeVariant(
  type: OurStoryType
): "default" | "secondary" | "accent" {
  const variants: Record<OurStoryType, "default" | "secondary" | "accent"> = {
    visitor: "default",
    trainee: "accent",
    counselor: "secondary",
  };
  return variants[type];
}
