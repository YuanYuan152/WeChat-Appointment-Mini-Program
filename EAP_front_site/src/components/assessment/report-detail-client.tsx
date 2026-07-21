"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAssessmentReports } from "@/lib/stores/assessment-reports";
import { formatReportTime } from "@/lib/assessment/report-summary";
import { enrichAssessmentGuidance } from "@/lib/assessment/scale-guidance";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/api/types";
import { ReportView } from "./report-view";

interface ReportDetailClientProps {
  reportId: string;
}

export function ReportDetailClient({ reportId }: ReportDetailClientProps) {
  return (
    <AssessmentAuthGate requireUser>
      <ReportDetailContent reportId={reportId} />
    </AssessmentAuthGate>
  );
}

function ReportDetailContent({ reportId }: ReportDetailClientProps) {
  const userId = useAuthStore((s) => s.user!.id);
  const report = useAssessmentReports((s) => s.getReport(userId, reportId));
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    (async () => {
      const full = await api.getAssessmentById(report.assessmentId, report.type);
      if (cancelled) return;
      if (full) {
        setAssessment(enrichAssessmentGuidance(full) as Assessment);
      } else {
        setAssessment(
          enrichAssessmentGuidance({
            id: report.assessmentId,
            title: report.assessmentTitle,
            subtitle: report.assessmentSubtitle,
            description: "",
            cover: report.cover,
            questionCount: 0,
            duration: 0,
            scoringType: report.scoringType,
            questions: [],
            disclaimer: report.disclaimer,
          }) as Assessment
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [report]);

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-muted-foreground">未找到该测评报告，可能已被删除。</p>
        <Link
          href="/assessment/reports"
          className="mt-6 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          返回报告列表
        </Link>
      </div>
    );
  }

  return (
    <section className="px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/assessment/reports"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回报告列表
        </Link>
        <div className="mb-2 text-center text-sm text-muted-foreground">
          完成时间：{formatReportTime(report.completedAt)}
        </div>
        <h1 className="mb-8 text-center font-serif text-2xl font-bold">
          {report.assessmentTitle} · 测评报告
        </h1>
        {assessment ? (
          <ReportView
            assessment={assessment}
            result={report.result}
            type={report.type}
            showActions={false}
          />
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">加载报告中…</div>
        )}
      </div>
    </section>
  );
}
