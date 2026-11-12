"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { AssessmentReportDialog } from "@/components/assessments/AssessmentReportDialog";
import { resolveImageUrl } from "@/components/content/ContentImageUpload";
import { AlertsTab } from "@/components/enterpriseData/AlertsTab";
import { AnalysisTab } from "@/components/enterpriseData/AnalysisTab";
import { ArchiveTab } from "@/components/enterpriseData/ArchiveTab";
import { FollowUpDialog } from "@/components/enterpriseData/FollowUpDialog";
import { OverviewTab } from "@/components/enterpriseData/OverviewTab";
import { RespondentDrawer } from "@/components/enterpriseData/RespondentDrawer";
import { SubmissionsTab } from "@/components/enterpriseData/SubmissionsTab";
import { TagsTab } from "@/components/enterpriseData/TagsTab";
import { EmptyHint, GhostButton, downloadBlob } from "@/components/enterpriseData/ui";
import {
  PERIOD_OPTIONS,
  applyFollowUp,
  chinaDateTimeText,
  isOpenAlert,
  scopeDataset,
  type PeriodKey,
} from "@/lib/enterpriseData";
import { fetchAssessmentReportDetail } from "@/services/assessmentReports";
import {
  deleteEnterpriseReport,
  exportEnterpriseDataset,
  fetchEnterpriseDataset,
  saveEnterpriseFollowUp,
  saveEnterpriseTagLibrary,
} from "@/services/enterpriseData";
import type { AssessmentReportDetail } from "@/types/assessmentReport";
import type {
  EnterpriseAnnotation,
  EnterpriseDataset,
  EnterpriseReportItem,
  EnterpriseTagGroup,
} from "@/types/enterpriseData";

type TabKey = "overview" | "analysis" | "alerts" | "archive" | "reports" | "tags";

const TABS: Array<{ key: TabKey; label: string; desc: string }> = [
  { key: "overview", label: "数据概览", desc: "建档进度、风险分布与趋势" },
  { key: "analysis", label: "分析报告", desc: "量表结果与分组热力对比" },
  { key: "alerts", label: "风险提醒", desc: "中高风险答卷与跟进" },
  { key: "archive", label: "员工档案", desc: "每位员工的测评、学习与标注" },
  { key: "reports", label: "答卷明细", desc: "全部提交记录与删除" },
  { key: "tags", label: "标注管理", desc: "标签库与标注动态" },
];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

export function AssessmentEnterpriseDataDetailScreen() {
  return (
    <AppRoute sectionId="assessmentEnterpriseData">
      <AssessmentEnterpriseDataDetailContent />
    </AppRoute>
  );
}

function AssessmentEnterpriseDataDetailContent() {
  const params = useParams<{ enterpriseId: string }>();
  const enterpriseId = decodeURIComponent(params.enterpriseId || "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearNotice, currentUser, isAdmin, refreshKey, setBreadcrumbTail, showNotice } = useAppRoute();
  const [dataset, setDataset] = useState<EnterpriseDataset>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "overview");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [respondentKey, setRespondentKey] = useState<string | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<EnterpriseReportItem | null>(null);
  const [reportTarget, setReportTarget] = useState<EnterpriseReportItem | null>(null);
  const [reportDetail, setReportDetail] = useState<AssessmentReportDetail>();
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingTags, setSavingTags] = useState(false);

  const load = useCallback(async () => {
    if (!enterpriseId) return;
    setLoading(true);
    setLoadError("");
    clearNotice();
    try {
      setDataset(await fetchEnterpriseDataset(enterpriseId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "企业数据加载失败";
      setLoadError(message);
      showNotice("error", message);
    } finally {
      setLoading(false);
    }
  }, [clearNotice, enterpriseId, showNotice]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setBreadcrumbTail(dataset?.enterprise.companyName || "企业数据");
    return () => setBreadcrumbTail(null);
  }, [dataset?.enterprise.companyName, setBreadcrumbTail]);

  const scoped = useMemo(() => (dataset ? scopeDataset(dataset, period) : null), [dataset, period]);
  const openAlertCount = useMemo(
    () => (scoped ? scoped.reports.filter((report) => isOpenAlert(report)).length : 0),
    [scoped],
  );
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label || "全部时间";

  const changeTab = (next: TabKey) => {
    setTab(next);
    const query = new URLSearchParams(searchParams.toString());
    query.set("tab", next);
    router.replace(`?${query.toString()}`, { scroll: false });
  };

  const openReport = (report: EnterpriseReportItem) => {
    setReportTarget(report);
    setReportDetail(undefined);
    setReportLoading(true);
    void fetchAssessmentReportDetail("eap", report.publicId)
      .then(setReportDetail)
      .catch((error) => {
        showNotice("error", error instanceof Error ? error.message : "报告加载失败");
        setReportTarget(null);
      })
      .finally(() => setReportLoading(false));
  };

  const deleteReport = (report: EnterpriseReportItem) => {
    if (!isAdmin) return;
    const respondent = dataset?.respondents.find((item) => item.key === report.respondentKey);
    const confirmed = window.confirm(
      `确认删除“${respondent?.displayName || "该员工"}”于 ${chinaDateTimeText(report.completedAt)} 提交的「${report.assessmentTitle}」答卷？\n删除后答案与结果将被清除且无法恢复。`,
    );
    if (!confirmed) return;
    void deleteEnterpriseReport(enterpriseId, report.publicId)
      .then(async () => {
        showNotice("success", "答卷已删除");
        await load();
      })
      .catch((error) => showNotice("error", error instanceof Error ? error.message : "删除失败"));
  };

  const exportExcel = () => {
    if (!dataset) return;
    setExporting(true);
    void exportEnterpriseDataset(enterpriseId)
      .then((file) => downloadBlob(file.blob, file.filename || `${dataset.enterprise.companyName || "企业"}-企业定制数据.xlsx`))
      .catch((error) => showNotice("error", error instanceof Error ? error.message : "导出失败"))
      .finally(() => setExporting(false));
  };

  const applyAnnotation = (annotation: EnterpriseAnnotation) => {
    setDataset((current) => {
      if (!current) return current;
      return {
        ...current,
        respondents: current.respondents.map((respondent) =>
          respondent.key === annotation.respondentKey
            ? {
                ...respondent,
                tags: annotation.tags,
                annotationCount: respondent.annotationCount + 1,
                lastAnnotatedAt: annotation.createdAt,
                ...(annotation.note
                  ? { lastNote: annotation.note, lastNoteBy: annotation.operatorName, lastNoteAt: annotation.createdAt }
                  : {}),
              }
            : respondent,
        ),
        recentAnnotations: [annotation, ...current.recentAnnotations].slice(0, 40),
      };
    });
  };

  const saveTags = async (groups: EnterpriseTagGroup[]) => {
    setSavingTags(true);
    try {
      const saved = await saveEnterpriseTagLibrary(enterpriseId, groups);
      setDataset((current) => (current ? { ...current, tagLibrary: saved } : current));
      showNotice("success", "标签库已保存");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "标签库保存失败");
      throw error;
    } finally {
      setSavingTags(false);
    }
  };

  if (!dataset || !scoped) {
    return (
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white p-8">
        {loading ? (
          <EmptyHint text="正在加载企业填写数据..." />
        ) : (
          <div className="space-y-4">
            <EmptyHint text={loadError || "企业数据暂不可用"} />
            <div className="flex justify-center gap-3">
              <GhostButton onClick={() => router.push("/assessment-enterprise-data")}>返回企业列表</GhostButton>
              <GhostButton tone="primary" onClick={() => void load()}>
                重新加载
              </GhostButton>
            </div>
          </div>
        )}
      </section>
    );
  }

  const { enterprise } = dataset;
  const authorizedTitles = dataset.assessments.filter((item) => item.authorized).map((item) => item.title);
  const tabBadge: Partial<Record<TabKey, number>> = {
    alerts: openAlertCount,
    archive: dataset.respondents.length,
    reports: scoped.reports.length,
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <div className="flex flex-wrap items-start gap-4 px-6 py-5">
          {enterprise.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-14 w-14 shrink-0 rounded-xl border border-[var(--lxxl-border)] bg-white object-contain p-1.5" src={resolveImageUrl(enterprise.logoUrl)} />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#EAF2ED] text-xl font-semibold text-[var(--lxxl-green)]">
              {(enterprise.companyName || "企").slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-[1_1_360px]">
            <h2 className="text-xl font-semibold">{enterprise.companyName || enterprise.siteName}</h2>
            <div className="mt-1 text-sm text-[var(--lxxl-muted)]">
              {enterprise.siteName} ·{" "}
              {enterprise.url ? (
                <a className="break-all text-[var(--lxxl-green)] hover:underline" href={enterprise.url} rel="noreferrer" target="_blank">
                  {enterprise.url}
                </a>
              ) : (
                enterprise.slug
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs leading-5">
              <span className="rounded-lg bg-[#F4F1EB] px-2.5 py-1 text-[#5A5A5A]">
                授权量表：{authorizedTitles.join("、") || "无"}
              </span>
              <span className="rounded-lg bg-[#F4F1EB] px-2.5 py-1 text-[#5A5A5A]">
                {enterprise.loginRequired
                  ? `人员表登录 · 员工 ${enterprise.personnelEmployeeCount} 人`
                  : "匿名填写（未启用人员表登录）"}
              </span>
              <span className="rounded-lg bg-[#F4F1EB] px-2.5 py-1 text-[#5A5A5A]">
                数据更新于 {chinaDateTimeText(dataset.generatedAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="统计时间范围"
              className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodKey)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <GhostButton disabled={exporting} onClick={exportExcel}>
              {exporting ? "正在导出..." : "导出 Excel"}
            </GhostButton>
            <GhostButton disabled={loading} onClick={() => void load()}>
              {loading ? "刷新中..." : "刷新数据"}
            </GhostButton>
            <GhostButton onClick={() => router.push("/assessment-enterprise-data")}>返回列表</GhostButton>
          </div>
        </div>
        <nav aria-label="企业数据子页面" className="flex gap-1 overflow-x-auto border-t border-[var(--lxxl-border)] px-4">
          {TABS.map((item) => {
            const active = item.key === tab;
            const badge = tabBadge[item.key];
            return (
              <button
                key={item.key}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 px-4 py-3.5 text-left transition ${
                  active ? "text-[var(--lxxl-green)]" : "text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]"
                }`}
                title={item.desc}
                type="button"
                onClick={() => changeTab(item.key)}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {item.label}
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        item.key === "alerts" ? "bg-[#B3261E] text-white" : "bg-[#F4F1EB] text-[var(--lxxl-muted)]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--lxxl-green)]" />}
              </button>
            );
          })}
        </nav>
      </section>

      {tab === "overview" && (
        <OverviewTab
          dataset={dataset}
          scoped={scoped}
          onGoTab={changeTab}
          onOpenFollowUp={setFollowUpTarget}
          onOpenRespondent={setRespondentKey}
        />
      )}
      {tab === "analysis" && (
        <AnalysisTab dataset={dataset} exporting={exporting} periodLabel={periodLabel} scoped={scoped} onExport={exportExcel} />
      )}
      {tab === "alerts" && (
        <AlertsTab
          dataset={dataset}
          scoped={scoped}
          onOpenFollowUp={setFollowUpTarget}
          onOpenReport={openReport}
          onOpenRespondent={setRespondentKey}
        />
      )}
      {tab === "archive" && <ArchiveTab dataset={dataset} onOpenRespondent={setRespondentKey} />}
      {tab === "reports" && (
        <SubmissionsTab
          dataset={dataset}
          isAdmin={isAdmin}
          scoped={scoped}
          onDeleteReport={deleteReport}
          onOpenFollowUp={setFollowUpTarget}
          onOpenReport={openReport}
          onOpenRespondent={setRespondentKey}
        />
      )}
      {tab === "tags" && (
        <TagsTab
          key={JSON.stringify(dataset.tagLibrary)}
          dataset={dataset}
          saving={savingTags}
          onOpenRespondent={setRespondentKey}
          onSave={saveTags}
        />
      )}

      {respondentKey && (
        <RespondentDrawer
          key={respondentKey}
          currentUserId={currentUser.id}
          dataset={dataset}
          enterpriseId={enterpriseId}
          isAdmin={isAdmin}
          respondentKey={respondentKey}
          showNotice={showNotice}
          onAnnotationCreated={applyAnnotation}
          onAnnotationDeleted={() => void load()}
          onClose={() => setRespondentKey(null)}
          onDeleteReport={deleteReport}
          onOpenFollowUp={setFollowUpTarget}
          onOpenReport={openReport}
        />
      )}

      {followUpTarget && (
        <FollowUpDialog
          report={dataset.reports.find((item) => item.publicId === followUpTarget.publicId) || followUpTarget}
          respondent={dataset.respondents.find((item) => item.key === followUpTarget.respondentKey)}
          onClose={() => setFollowUpTarget(null)}
          onSave={async (input) => {
            const saved = await saveEnterpriseFollowUp(enterpriseId, followUpTarget.publicId, input);
            setDataset((current) => (current ? applyFollowUp(current, followUpTarget.publicId, saved) : current));
            setFollowUpTarget(null);
            showNotice("success", "跟进记录已保存");
          }}
        />
      )}

      {reportTarget && (
        <AssessmentReportDialog
          detail={reportDetail}
          loading={reportLoading}
          onClose={() => {
            setReportTarget(null);
            setReportDetail(undefined);
          }}
        />
      )}
    </div>
  );
}
