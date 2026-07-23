"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ChevronRight, ClipboardList, Loader2, Trash2 } from "lucide-react";
import { AssessmentImage } from "@/components/assessment/assessment-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  deleteAssessmentReport,
  listAssessmentReports,
} from "@/lib/assessment/api";
import { formatReportTime } from "@/lib/assessment/report-summary";
import type { AssessmentReportListItem } from "@/lib/api/types";

export function AssessmentReportsList() {
  return (
    <AssessmentAuthGate requireUser>
      <AssessmentReportsListContent />
    </AssessmentAuthGate>
  );
}

function AssessmentReportsListContent() {
  const token = useAuthStore((state) => state.token!);
  const [reports, setReports] = useState<AssessmentReportListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem("assessment-reports");
    listAssessmentReports(token)
      .then((page) => {
        if (!cancelled) {
          setReports(page.items);
          setPage(page.page);
          setTotal(page.total);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "报告列表加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDelete = async (report: AssessmentReportListItem) => {
    if (!window.confirm(`确认删除“${report.assessmentTitle}”报告吗？删除后无法恢复。`)) {
      return;
    }
    setDeletingId(report.publicId);
    setError(null);
    try {
      await deleteAssessmentReport(token, report.publicId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败，请稍后重试");
      setDeletingId(null);
      return;
    }
    try {
      const refreshed = await listAssessmentReports(token, { page: 1, pageSize: 20 });
      setReports(refreshed.items);
      setPage(refreshed.page);
      setTotal(refreshed.total);
    } catch {
      setReports((current) => current.filter((item) => item.publicId !== report.publicId));
      setTotal((current) => Math.max(0, current - 1));
      setError("报告已删除，但列表刷新失败，请重新打开页面。");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || reports.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await listAssessmentReports(token, { page: page + 1, pageSize: 20 });
      setReports((current) => {
        const existing = new Set(current.map((item) => item.publicId));
        return [...current, ...next.items.filter((item) => !existing.has(item.publicId))];
      });
      setPage(next.page);
      setTotal(next.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更多报告加载失败");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在同步账号报告…
      </div>
    );
  }

  if (reports.length === 0 && !error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 font-serif text-lg font-semibold">暂无测评报告</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            登录后完成心理测评，报告将同步保存在您的账号下。
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
      {error ? (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}
      {reports.map((report, index) => (
        <motion.article
          key={report.publicId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex flex-col sm:flex-row">
            <Link
              href={`/assessment/reports/${report.publicId}`}
              className="relative aspect-[2/1] w-full shrink-0 sm:aspect-auto sm:h-auto sm:w-48"
            >
              <AssessmentImage
                source={report.cover}
                alt={report.assessmentTitle}
                className="object-cover"
                sizes="192px"
              />
            </Link>
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={report.category === "professional" ? "default" : "accent"}>
                    {report.category === "professional" ? "专业量表" : "趣味探索"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatReportTime(report.completedAt)}
                  </span>
                </div>
                <Link href={`/assessment/reports/${report.publicId}`}>
                  <h3 className="mt-2 font-serif text-lg font-semibold transition-colors group-hover:text-primary">
                    {report.assessmentTitle}
                  </h3>
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.assessmentSubtitle}
                </p>
                <p className="mt-3 line-clamp-2 text-sm font-medium text-primary/90">
                  {report.resultSummary}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Link href={`/assessment/reports/${report.publicId}`}>
                  <Button size="sm" variant="outline">
                    查看报告
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deletingId === report.publicId}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDelete(report)}
                >
                  {deletingId === report.publicId ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  删除
                </Button>
              </div>
            </div>
          </div>
        </motion.article>
      ))}
      {reports.length < total ? (
        <div className="pt-2 text-center">
          <Button variant="outline" disabled={loadingMore} onClick={() => void handleLoadMore()}>
            {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loadingMore ? "加载中…" : "加载更多报告"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
