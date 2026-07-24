"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getAssessmentReport } from "@/lib/assessment/api";
import { formatReportTime } from "@/lib/assessment/report-summary";
import type { Assessment, AssessmentReportDetail } from "@/lib/api/types";
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
  const token = useAuthStore((state) => state.token!);
  const [report, setReport] = useState<AssessmentReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem("assessment-reports");
    getAssessmentReport(token, reportId)
      .then((value) => {
        if (!cancelled) setReport(value);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "未找到该测评报告，可能已被删除。"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId, token]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在读取报告快照…
      </div>
    );
  }

  if (!report || error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">
          {error ?? "未找到该测评报告，可能已被删除。"}
        </p>
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

  const snapshotAssessment = report.reportSnapshot.assessment;
  const assessment: Assessment = {
    ...snapshotAssessment,
    questionCount: snapshotAssessment.questions.length,
  };

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
        <ReportView
          assessment={assessment}
          result={report.reportSnapshot.result}
          type={report.category}
          showActions={false}
        />
      </div>
    </section>
  );
}
