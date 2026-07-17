"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AssessmentReportsLink() {
  const token = useAuthStore((s) => s.token);
  const href = token ? "/assessment/reports" : "/login?redirect=%2Fassessment%2Freports";

  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
    >
      <ClipboardList className="h-4 w-4" />
      我的测评报告
    </Link>
  );
}
