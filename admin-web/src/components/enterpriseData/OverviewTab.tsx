"use client";

import { useMemo, useState } from "react";

import { Donut, TrendChart } from "@/components/enterpriseData/charts";
import {
  DataCard,
  EmptyHint,
  FollowUpChip,
  LinkButton,
  ProgressBar,
  SeverityChip,
  StatCard,
} from "@/components/enterpriseData/ui";
import {
  SEVERITY_KEYS,
  SEVERITY_META,
  UNGRADED_META,
  buildMonthlyTrend,
  chinaDateTimeText,
  chinaMonthKey,
  countSeverities,
  followUpStatusOf,
  formatPercent,
  groupRespondents,
  groupableFields,
  isOpenAlert,
  ratio,
  severityRank,
  type ScopedDataset,
} from "@/lib/enterpriseData";
import type { EnterpriseDataset, EnterpriseReportItem } from "@/types/enterpriseData";

export function OverviewTab({
  dataset,
  scoped,
  onGoTab,
  onOpenFollowUp,
  onOpenRespondent,
}: {
  dataset: EnterpriseDataset;
  scoped: ScopedDataset;
  onGoTab: (tab: "analysis" | "alerts" | "archive" | "reports" | "tags") => void;
  onOpenFollowUp: (report: EnterpriseReportItem) => void;
  onOpenRespondent: (key: string) => void;
}) {
  const { enterprise } = dataset;
  const severity = countSeverities(scoped.respondents);
  const graded = severity.total - severity.none;
  const risk = severity.high + severity.mid;
  const target = enterprise.personnelEmployeeCount;
  const doneCount = scoped.respondents.filter((item) => item.status === "done").length;
  const thisMonth = chinaMonthKey(new Date().toISOString());
  const monthReports = scoped.reports.filter((report) => chinaMonthKey(report.completedAt) === thisMonth).length;
  const trend = useMemo(
    () => buildMonthlyTrend(scoped.reports, scoped.respondents, 6),
    [scoped.reports, scoped.respondents],
  );
  const respondentByKey = useMemo(
    () => new Map(dataset.respondents.map((item) => [item.key, item])),
    [dataset.respondents],
  );
  const openAlerts = useMemo(
    () =>
      scoped.reports
        .filter((report) => isOpenAlert(report))
        .sort(
          (left, right) =>
            severityRank(right.severity) - severityRank(left.severity)
            || (right.completedAt || "").localeCompare(left.completedAt || ""),
        ),
    [scoped.reports],
  );
  const authorized = dataset.assessments.filter((assessment) => assessment.authorized);
  const groupFields = useMemo(() => groupableFields(dataset.fields), [dataset.fields]);
  const [groupFieldId, setGroupFieldId] = useState(groupFields[0]?.id || "");
  const groups = useMemo(
    () => (groupFieldId ? groupRespondents(scoped.respondents, groupFieldId, 8) : []),
    [groupFieldId, scoped.respondents],
  );
  const learning = dataset.learning;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-[#2F4A40] to-[#4E7464] px-6 py-5 text-white">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 5h6l2 2h8v12H4z" />
          </svg>
        </div>
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="text-base font-semibold">
            员工心理档案建设 ·{target > 0 ? `人员表 ${target} 人` : "匿名链接（未生成人员表）"}
          </div>
          <div className="mt-1 text-sm text-white/80">
            已有 {scoped.respondents.length} 人填写
            {target > 0 ? `（覆盖 ${formatPercent(ratio(scoped.respondents.length, target))}）` : ""} · 完成全部量表 {doneCount} 人 · 中高风险 {risk} 人
          </div>
        </div>
        <button
          className="h-9 shrink-0 rounded-xl bg-white px-4 text-sm font-medium text-[var(--lxxl-green)] transition hover:bg-white/90"
          type="button"
          onClick={() => onGoTab("archive")}
        >
          查看员工档案
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="建档目标"
          note={target > 0 ? `已建档 ${scoped.respondents.length} 人 · 未开始 ${Math.max(0, target - dataset.roster.filter((item) => item.respondentKey).length)} 人` : "未生成人员表，按实际填写人数统计"}
          unit={target > 0 ? "人" : ""}
          value={target > 0 ? target : "—"}
        >
          {target > 0 && (
            <div className="mt-3">
              <ProgressBar max={target} value={scoped.respondents.length} />
            </div>
          )}
        </StatCard>
        <StatCard
          label="已填写人数"
          note={`完成全部授权量表 ${doneCount} 人（${formatPercent(ratio(doneCount, scoped.respondents.length))}）`}
          unit="人"
          value={scoped.respondents.length}
        />
        <StatCard label="答卷总数" note={`本月新增 ${monthReports} 份`} unit="份" value={scoped.reports.length} />
        <StatCard
          label="需重点关注"
          note={`高风险 ${severity.high} · 中度 ${severity.mid} · 一般关注 ${severity.watch}`}
          tone={risk > 0 ? "risk" : "good"}
          unit="人"
          value={risk}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DataCard
          right={
            <div className="flex items-center gap-4 text-xs text-[var(--lxxl-muted)]">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--lxxl-green)]" />答卷数
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-0.5 w-3.5 bg-[#B86A1E]" />中高风险检出率
              </span>
            </div>
          }
          sub="近 6 个月（北京时间）· 检出率 = 中高风险答卷 / 可分级答卷"
          title="月度填写与风险趋势"
        >
          <TrendChart points={trend} />
        </DataCard>
        <DataCard sub={`按每人最近一次答卷统计 · 可分级 ${graded} 人`} title="风险等级分布">
          <div className="flex flex-wrap items-center gap-6">
            <Donut
              center={graded > 0 ? formatPercent(ratio(severity.ok, graded), 0) : "-"}
              segments={[
                ...[...SEVERITY_KEYS]
                  .reverse()
                  .map((key) => ({ key, value: severity[key], color: SEVERITY_META[key].chart })),
                { key: "none", value: severity.none, color: UNGRADED_META.chart },
              ]}
              sub="状态良好"
            />
            <div className="min-w-[160px] flex-1 space-y-2.5">
              {[...SEVERITY_KEYS].reverse().map((key) => (
                <LegendRow
                  key={key}
                  color={SEVERITY_META[key].chart}
                  count={severity[key]}
                  label={SEVERITY_META[key].label}
                  total={severity.total}
                />
              ))}
              <LegendRow color={UNGRADED_META.chart} count={severity.none} label="未分级" total={severity.total} />
            </div>
          </div>
          {severity.none > 0 && (
            <p className="mt-4 text-xs leading-5 text-[var(--lxxl-muted)]">
              「未分级」表示量表结果等级无法对应风险程度（如只设置了一个结果区间）。可在风险提醒中人工调整等级，或在量表管理中细分分数区间。
            </p>
          )}
        </DataCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DataCard
          right={<LinkButton onClick={() => onGoTab("alerts")}>全部风险提醒</LinkButton>}
          sub="中高风险且尚未标记“已缓解 / 无需跟进”的答卷"
          title={`待处理风险提醒 · ${openAlerts.length}`}
        >
          {openAlerts.length === 0 ? (
            <EmptyHint text="当前没有待处理的风险答卷" />
          ) : (
            <div className="divide-y divide-[var(--lxxl-border)]">
              {openAlerts.slice(0, 5).map((report) => {
                const respondent = respondentByKey.get(report.respondentKey);
                return (
                  <div key={report.publicId} className="flex flex-wrap items-center gap-3 py-3">
                    <SeverityChip severity={report.severity} size="xs" />
                    <button
                      className="min-w-0 flex-1 text-left"
                      type="button"
                      onClick={() => onOpenRespondent(report.respondentKey)}
                    >
                      <div className="truncate text-sm font-medium hover:text-[var(--lxxl-green)]">
                        {respondent?.displayName || "填写者"} · {report.assessmentTitle}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--lxxl-muted)]">
                        {report.triggers.map((item) => `${item.title} ${item.level}`).join("、") || report.summary}
                      </div>
                    </button>
                    <FollowUpChip size="xs" status={followUpStatusOf(report)} />
                    <span className="w-24 text-right text-xs text-[var(--lxxl-muted)]">{chinaDateTimeText(report.completedAt).slice(5)}</span>
                    <button
                      className="text-xs font-medium text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]"
                      type="button"
                      onClick={() => onOpenFollowUp(report)}
                    >
                      跟进
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        <DataCard sub="已填写人数中完成该量表的比例（含历史授权量表）" title="量表完成情况">
          {dataset.assessments.length === 0 ? (
            <EmptyHint text="尚未授权量表" />
          ) : (
            <div className="space-y-4">
              {dataset.assessments.map((assessment) => {
                const completed = scoped.respondents.filter((item) => item.completedAssessmentIds.includes(assessment.id)).length;
                const reports = scoped.latest.filter((report) => report.assessmentId === assessment.id);
                const counts = countSeverities(reports);
                return (
                  <div key={assessment.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        {assessment.title}
                        {!assessment.authorized && <span className="ml-2 text-xs font-normal text-[var(--lxxl-muted)]">已取消授权</span>}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--lxxl-muted)]">
                        {completed}/{scoped.respondents.length} 人 · 中高风险 {counts.high + counts.mid}
                      </span>
                    </div>
                    <ProgressBar max={Math.max(1, scoped.respondents.length)} value={completed} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--lxxl-border)] pt-4 text-center sm:grid-cols-4">
            <MiniFigure label="填写者" value={scoped.respondents.length} />
            <MiniFigure label="人工标注" value={dataset.respondents.filter((item) => item.annotationCount > 0).length} />
            <MiniFigure label="风险跟进记录" value={dataset.reports.filter((item) => item.followUp).length} />
            <MiniFigure label="知识库学习" value={learning.totalViews} />
          </div>
        </DataCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <DataCard
          right={
            groupFields.length > 0 ? (
              <select
                aria-label="分组字段"
                className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
                value={groupFieldId}
                onChange={(event) => setGroupFieldId(event.target.value)}
              >
                {groupFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    按{field.label}
                  </option>
                ))}
              </select>
            ) : undefined
          }
          sub="按员工填写的基本信息分组 · 条形为中高风险人数占比"
          title="人群画像"
        >
          {groups.length === 0 ? (
            <EmptyHint text="暂无可分组的员工信息字段" />
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const counts = countSeverities(group.items);
                const gradedCount = counts.total - counts.none;
                const rate = ratio(counts.high + counts.mid, gradedCount);
                return (
                  <div key={group.value} className="flex items-center gap-3 rounded-lg bg-[#FAF8F4] px-3 py-2.5">
                    <div className="w-32 min-w-0 shrink-0">
                      <div className="truncate text-sm font-medium" title={group.value}>{group.value}</div>
                      <div className="text-[11px] text-[var(--lxxl-muted)]">{group.items.length} 人</div>
                    </div>
                    <div className="flex-1">
                      <ProgressBar color={rate && rate >= 0.3 ? "#B3261E" : rate && rate > 0 ? "#B86A1E" : "#2F7A55"} max={1} value={rate ?? 0} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-[var(--lxxl-muted)]">
                      {rate === null ? "未分级" : `风险 ${formatPercent(rate, 0)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        <DataCard
          sub={enterprise.hideLibrary ? "该企业页面已隐藏心理知识库" : "企业站图文阅读与音频播放自动回传"}
          title="知识库学习"
        >
          {learning.totalViews === 0 ? (
            <EmptyHint text={enterprise.hideLibrary ? "知识库已隐藏，不产生学习记录" : "暂无学习记录，员工在企业站打开图文或播放音频后自动统计"} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniFigure label="学习次数" value={learning.totalViews} />
                <MiniFigure label="参与人数" value={learning.learnerCount} />
                <MiniFigure label="累计分钟" value={learning.totalMinutes} />
              </div>
              <div className="mt-4 divide-y divide-[var(--lxxl-border)]">
                {learning.topContents.slice(0, 6).map((item) => (
                  <div key={`${item.contentType}-${item.contentId}`} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        item.contentType === "audio" ? "bg-[#E8F0F8] text-[#2E5E8C]" : "bg-[#EAF2ED] text-[#2F7A55]"
                      }`}
                    >
                      {item.contentType === "audio" ? "音频" : "图文"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    <span className="shrink-0 text-xs text-[var(--lxxl-muted)]">
                      {item.views} 次 · {item.learners} 人
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DataCard>
      </div>

      {authorized.length > 0 && scoped.reports.length === 0 && (
        <EmptyHint text="当前时间范围内还没有员工提交答卷，可切换为“全部时间”查看历史数据。" />
      )}
    </div>
  );
}

function LegendRow({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="flex-1 text-[var(--lxxl-muted)]">{label}</span>
      <span className="font-semibold">{count}</span>
      <span className="w-12 text-right text-xs text-[var(--lxxl-muted)]">{formatPercent(ratio(count, total), 0)}</span>
    </div>
  );
}

function MiniFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#FAF8F4] px-2 py-2.5">
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--lxxl-muted)]">{label}</div>
    </div>
  );
}
