"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AssessmentReportsEntry() {
  const token = useAuthStore((s) => s.token);
  const href = token ? "/assessment/reports" : "/login?redirect=%2Fassessment%2Freports";

  return (
    <Link href={href} className="group mt-6 block">
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex sm:items-center sm:gap-6">
        <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 sm:mb-0">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-lg font-semibold group-hover:text-primary">
            我的测评报告
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {token
              ? "查看您已完成测评的历史记录与详细评估报告"
              : "登录后查看您已完成测评的历史记录与详细评估报告"}
          </p>
        </div>
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "mt-4 sm:mt-0 pointer-events-none"
          )}
        >
          {token ? "查看报告" : "登录查看"}
        </span>
      </div>
    </Link>
  );
}
