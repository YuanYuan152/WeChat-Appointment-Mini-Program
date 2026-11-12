"use client";

import { useMemo, useState } from "react";

import { heatColor } from "@/components/enterpriseData/charts";
import { DataCard, EmptyHint, StackedBar, type StackSegment } from "@/components/enterpriseData/ui";
import {
  SEVERITY_META,
  UNGRADED_META,
  buildAssessmentStats,
  buildFindings,
  buildGroupComparison,
  countSeverities,
  formatPercent,
  formatScore,
  groupableFields,
  metricCell,
  metricColumns,
  ratio,
  type AssessmentStats,
  type LevelCount,
  type ScopedDataset,
} from "@/lib/enterpriseData";
import type { EnterpriseDataset } from "@/types/enterpriseData";

// 无法识别风险程度的等级用中性色，避免绿色/红色暗示好坏
const LEVEL_PALETTE = ["#7C8DA6", "#A3B1C6", "#B5A58F", "#8E7CC3", "#6B9AC4", "#C9B79C", "#9A9A9A"];

function levelColor(level: LevelCount, index: number) {
  if (level.severity) {
    return SEVERITY_META[level.severity].chart;
  }
  return level.level === "未分级" ? UNGRADED_META.chart : LEVEL_PALETTE[index % LEVEL_PALETTE.length];
}

function levelSegments(levels: LevelCount[]): StackSegment[] {
  return levels.map((level, index) => ({
    key: level.level,
    label: level.level,
    value: level.count,
    color: levelColor(level, index),
  }));
}

export function AnalysisTab({
  dataset,
  scoped,
  periodLabel,
  exporting,
  onExport,
}: {
  dataset: EnterpriseDataset;
  scoped: ScopedDataset;
  periodLabel: string;
  exporting: boolean;
  onExport: () => void;
}) {
  const groupFields = useMemo(() => groupableFields(dataset.fields), [dataset.fields]);
  const [groupFieldId, setGroupFieldId] = useState(groupFields[0]?.id || "");
  const groupField = groupFields.find((field) => field.id === groupFieldId) || null;
  const columns = useMemo(() => metricColumns(dataset.assessments, scoped.latest), [dataset.assessments, scoped.latest]);
  const groupRows = useMemo(
    () => (groupFieldId ? buildGroupComparison(scoped.respondents, scoped.latest, groupFieldId, columns) : []),
    [columns, groupFieldId, scoped.latest, scoped.respondents],
  );
  const overallCells = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.key, metricCell(scoped.latest, column)])),
    [columns, scoped.latest],
  );
  const stats = useMemo(
    () =>
      dataset.assessments
        .map((assessment) => buildAssessmentStats(assessment, scoped.latest))
        .filter((item) => item.n > 0),
    [dataset.assessments, scoped.latest],
  );
  const findings = useMemo(
    () => buildFindings({ dataset, scoped, groupField, groupRows, columns, overallCells }),
    [columns, dataset, groupField, groupRows, overallCells, scoped],
  );
  const severity = countSeverities(scoped.respondents);
  const graded = severity.total - severity.none;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-4 bg-gradient-to-r from-[#2F4A40] to-[#4E7464] px-7 py-6 text-white">
          <div>
            <div className="text-xs tracking-[0.2em] text-white/75">员工心理测评 · 总体分析报告</div>
            <h3 className="mt-2 text-2xl font-semibold">{dataset.enterprise.companyName || dataset.enterprise.siteName}</h3>
            <div className="mt-2 text-sm text-white/80">
              统计范围：{periodLabel} · 样本 {scoped.respondents.length} 人 · 答卷 {scoped.reports.length} 份 · 风险等级按每人最近一次答卷计算
            </div>
          </div>
          <button
            className="h-9 rounded-xl bg-white px-4 text-sm font-medium text-[var(--lxxl-green)] transition hover:bg-white/90 disabled:opacity-60"
            disabled={exporting}
            type="button"
            onClick={onExport}
          >
            {exporting ? "正在导出..." : "导出 Excel"}
          </button>
        </div>
        <div className="grid divide-y divide-[var(--lxxl-border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[
            ["填写人数", `${scoped.respondents.length}`],
            ["可分级人数", `${graded}`],
            ["中高风险", `${severity.high + severity.mid}（${formatPercent(ratio(severity.high + severity.mid, graded))}）`],
            ["一般关注", `${severity.watch}（${formatPercent(ratio(severity.watch, graded))}）`],
          ].map(([label, value]) => (
            <div key={label} className="px-7 py-4">
              <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
              <div className="mt-1 text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {stats.length === 0 ? (
        <EmptyHint text="当前范围内没有可分析的答卷" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {stats.map((item) => (
            <AssessmentCard key={item.assessment.id} stats={item} />
          ))}
        </div>
      )}

      <DataCard
        right={
          groupFields.length > 0 ? (
            <select
              aria-label="对比维度"
              className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
              value={groupFieldId}
              onChange={(event) => setGroupFieldId(event.target.value)}
            >
              {groupFields.map((field) => (
                <option key={field.id} value={field.id}>
                  按{field.label}对比
                </option>
              ))}
            </select>
          ) : undefined
        }
        sub="单元格为“一般关注及以上”的比例，颜色越红越需关注；悬停可看平均分与人数"
        title="分组热力对比"
      >
        {columns.length === 0 || groupRows.length === 0 ? (
          <EmptyHint text="暂无可对比的数据（需要员工基本信息字段与可分级的量表结果）" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-xs text-[var(--lxxl-muted)]">
                  <th className="whitespace-nowrap px-2 py-2 text-left font-medium">{groupField?.label || "分组"}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium">人数</th>
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium">中高风险</th>
                  {columns.map((column) => (
                    <th key={column.key} className="px-2 py-2 text-center font-medium" title={column.subtitle}>
                      <div className="text-[var(--lxxl-text)]">{column.title}</div>
                      <div className="mt-0.5 text-[10px] font-normal">{column.subtitle}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="whitespace-nowrap px-2 py-2 font-semibold">整体</td>
                  <td className="px-2 py-2 text-center">{scoped.respondents.length}</td>
                  <td className="px-2 py-2 text-center">{formatPercent(ratio(severity.high + severity.mid, graded), 0)}</td>
                  {columns.map((column) => (
                    <HeatCell key={column.key} cell={overallCells[column.key]} />
                  ))}
                </tr>
                {groupRows.map((row) => (
                  <tr key={row.value}>
                    <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-2" title={row.value}>
                      {row.value}
                    </td>
                    <td className="px-2 py-2 text-center text-[var(--lxxl-muted)]">{row.count}</td>
                    <td
                      className="px-2 py-2 text-center font-medium"
                      style={{ color: row.riskRate && row.riskRate > 0 ? "#B3261E" : "#2F7A55" }}
                    >
                      {row.riskRate === null ? "-" : formatPercent(row.riskRate, 0)}
                    </td>
                    {columns.map((column) => (
                      <HeatCell key={column.key} cell={row.cells[column.key]} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard sub="根据当前范围的数据自动生成，仅供参考，请结合专业评估使用" title="主要发现">
        <div className="grid gap-3 lg:grid-cols-2">
          {findings.map((finding) => {
            const tone =
              finding.tone === "risk"
                ? { bar: "#B3261E", bg: "#FDF3F2" }
                : finding.tone === "good"
                  ? { bar: "#2F7A55", bg: "#F1F7F3" }
                  : { bar: "#3D5A4E", bg: "#F6F4EF" };
            return (
              <div key={finding.title} className="flex gap-3 rounded-xl p-4" style={{ background: tone.bg }}>
                <span className="w-1 shrink-0 rounded-full" style={{ background: tone.bar }} />
                <div>
                  <div className="text-sm font-semibold">{finding.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[#5A5A5A]">{finding.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </DataCard>
    </div>
  );
}

function HeatCell({ cell }: { cell: ReturnType<typeof metricCell> | undefined }) {
  if (!cell || cell.n === 0) {
    return <td className="rounded-md bg-[#FAF8F4] px-2 py-2 text-center text-xs text-[var(--lxxl-muted)]">-</td>;
  }
  const color = heatColor(cell.flaggedRate);
  return (
    <td
      className="rounded-md px-2 py-2 text-center font-semibold"
      style={{ background: color.bg, color: color.fg }}
      title={`人数 ${cell.n} · 关注 ${cell.flagged}/${cell.graded} · 平均分 ${formatScore(cell.avgScore)}`}
    >
      {cell.flaggedRate === null ? "未分级" : formatPercent(cell.flaggedRate, 0)}
      <div className="text-[10px] font-normal opacity-80">均分 {formatScore(cell.avgScore)}</div>
    </td>
  );
}

function AssessmentCard({ stats }: { stats: AssessmentStats }) {
  const { assessment } = stats;
  const segments = levelSegments(stats.levels);
  return (
    <DataCard
      sub={`${stats.n} 人的最近一次结果 · ${assessment.resultType === "dimension" ? "维度计分" : assessment.resultType === "match" ? "类型匹配" : "总分计分"}`}
      title={assessment.title}
    >
      {assessment.resultType !== "dimension" && (
        <>
          {stats.avgScore !== null && (
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["平均分", formatScore(stats.avgScore)],
                ["最低分", formatScore(stats.minScore)],
                ["最高分", formatScore(stats.maxScore)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#FAF8F4] px-2 py-2.5">
                  <div className="text-lg font-semibold">{value}</div>
                  <div className="text-[11px] text-[var(--lxxl-muted)]">{label}</div>
                </div>
              ))}
            </div>
          )}
          <StackedBar height={12} segments={segments} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((segment) => (
              <span key={segment.key} className="flex items-center gap-1.5 text-xs text-[var(--lxxl-muted)]">
                <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: segment.color }} />
                {segment.label}
                <b className="font-semibold text-[var(--lxxl-text)]">{segment.value}</b>
                <span>({formatPercent(ratio(segment.value, stats.n), 0)})</span>
              </span>
            ))}
          </div>
          {stats.severity.none === stats.n && assessment.resultType === "sum" && (
            <p className="mt-3 text-xs leading-5 text-[var(--lxxl-muted)]">
              该量表的结果区间未区分风险程度，平台无法自动分级；如需风险提醒，可在量表管理中细分分数区间等级，或在风险提醒页人工调整。
            </p>
          )}
        </>
      )}
      {assessment.resultType === "dimension" && (
        <div className="space-y-4">
          {stats.dimensions
            .filter((dimension) => dimension.n > 0)
            .map((dimension) => {
              const dimensionSegments = levelSegments(dimension.levels);
              return (
                <div key={dimension.id}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{dimension.title}</span>
                    <span className="text-xs text-[var(--lxxl-muted)]">
                      均分 {formatScore(dimension.avgScore)} · 关注比例{" "}
                      <b className="font-semibold" style={{ color: heatColor(dimension.flaggedRate).fg }}>
                        {formatPercent(dimension.flaggedRate, 0)}
                      </b>
                    </span>
                  </div>
                  <StackedBar segments={dimensionSegments} />
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {dimensionSegments.map((segment) => (
                      <span key={segment.key} className="flex items-center gap-1 text-[11px] text-[var(--lxxl-muted)]">
                        <i className="inline-block h-2 w-2 rounded-sm" style={{ background: segment.color }} />
                        {segment.label} {segment.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
      {assessment.resultType === "match" && stats.levels.length === 0 && <EmptyHint text="暂无结果" />}
    </DataCard>
  );
}
