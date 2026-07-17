"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ClipboardList, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCurrentUserReports, useAssessmentReports } from "@/lib/stores/assessment-reports";
import { formatReportTime } from "@/lib/assessment/report-summary";

export function AssessmentReportsList() {
  return (
    <AssessmentAuthGate requireUser>
      <AssessmentReportsListContent />
    </AssessmentAuthGate>
  );
}

function AssessmentReportsListContent() {
  const userId = useAuthStore((s) => s.user!.id);
  const reports = useCurrentUserReports();
  const removeReport = useAssessmentReports((s) => s.removeReport);

  if (reports.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 font-serif text-lg font-semibold">暂无测评报告</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            登录后完成心理测评，报告将保存在您的账号下。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/assessment/professional">
              <Button>去做专业测评</Button>
            </Link>
            <Link href="/assessment/fun">
              <Button variant="outline">去做趣味测评</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-12 sm:px-6">
      {reports.map((report, index) => (
        <motion.article
          key={report.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex flex-col sm:flex-row">
            <Link
              href={`/assessment/reports/${report.id}`}
              className="relative aspect-[2/1] w-full shrink-0 sm:aspect-auto sm:h-auto sm:w-48"
            >
              <Image
                src={report.cover}
                alt={report.assessmentTitle}
                fill
                className="object-cover"
                sizes="192px"
              />
            </Link>
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={report.type === "professional" ? "default" : "accent"}>
                    {report.type === "professional" ? "专业量表" : "趣味探索"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatReportTime(report.completedAt)}
                  </span>
                </div>
                <Link href={`/assessment/reports/${report.id}`}>
                  <h3 className="mt-2 font-serif text-lg font-semibold transition-colors group-hover:text-primary">
                    {report.assessmentTitle}
                  </h3>
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{report.assessmentSubtitle}</p>
                <p className="mt-3 line-clamp-2 text-sm font-medium text-primary/90">
                  {report.resultSummary}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Link href={`/assessment/reports/${report.id}`}>
                  <Button size="sm" variant="outline">
                    查看报告
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeReport(userId, report.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
