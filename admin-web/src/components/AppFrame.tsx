"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppRoute } from "@/components/AppRoute";
import { sections } from "@/config/navigation";
import type { SectionId } from "@/types/app";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <AppRoute sectionId={getSectionIdByPathname(pathname)}>{children}</AppRoute>;
}

function getSectionIdByPathname(pathname: string): SectionId {
  const normalizedPathname = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return sections.find((section) => section.path === normalizedPathname)?.id || "dashboard";
}
