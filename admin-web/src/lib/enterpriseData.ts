/**
 * 企业定制数据管理的纯计算逻辑（无 React、无运行时依赖，便于 node --test 直接验证）。
 * 后端只给出原始答卷、填写者与跟进记录，概览、分析报告里的统计都在这里算。
 */
import type {
  EnterpriseDataAssessment,
  EnterpriseDataField,
  EnterpriseDataset,
  EnterpriseFollowUp,
  EnterpriseReportItem,
  EnterpriseRespondent,
  EnterpriseRosterItem,
  FollowUpStatus,
  RespondentStatus,
  Severity,
} from "@/types/enterpriseData";

export const SEVERITY_KEYS: Severity[] = ["high", "mid", "watch", "ok"];

/** color/bg 用于文字标签（保证对比度），chart 用于图表色块（色相拉开便于区分）。 */
export const SEVERITY_META: Record<
  Severity,
  { label: string; short: string; color: string; bg: string; chart: string; rank: number }
> = {
  high: { label: "高风险", short: "高", color: "#B3261E", bg: "#FBE8E6", chart: "#C8312A", rank: 3 },
  mid: { label: "中度风险", short: "中", color: "#B4570F", bg: "#FCEFE0", chart: "#E08A2E", rank: 2 },
  watch: { label: "一般关注", short: "关注", color: "#86660F", bg: "#FBF3DF", chart: "#E3C34D", rank: 1 },
  ok: { label: "状态良好", short: "良好", color: "#2F7A55", bg: "#EAF2ED", chart: "#3E8E68", rank: 0 },
};

export const UNGRADED_META = { label: "未分级", short: "未分级", color: "#8A8A8A", bg: "#F4F1EB", chart: "#C9C3B8" };

export const FOLLOW_UP_META: Record<FollowUpStatus, { label: string; color: string; bg: string; closed: boolean }> = {
  pending: { label: "待联系", color: "#B3261E", bg: "#FBE8E6", closed: false },
  engaged: { label: "已介入", color: "#2E5E8C", bg: "#E8F0F8", closed: false },
  following: { label: "跟进中", color: "#B86A1E", bg: "#FCEFE0", closed: false },
  resolved: { label: "已缓解", color: "#2F7A55", bg: "#EAF2ED", closed: true },
  dismissed: { label: "无需跟进", color: "#6B6B6B", bg: "#F1EFEB", closed: true },
};

export const FOLLOW_UP_KEYS: FollowUpStatus[] = ["pending", "engaged", "following", "resolved", "dismissed"];

export const RESPONDENT_STATUS_META: Record<RespondentStatus, { label: string; color: string; bg: string }> = {
  done: { label: "已完成", color: "#2F7A55", bg: "#EAF2ED" },
  doing: { label: "进行中", color: "#2E5E8C", bg: "#E8F0F8" },
  todo: { label: "未开始", color: "#6B6B6B", bg: "#F1EFEB" },
};

export type PeriodKey = "all" | "30" | "90" | "180" | "365";

export const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "all", label: "全部时间" },
  { value: "30", label: "近 30 天" },
  { value: "90", label: "近 90 天" },
  { value: "180", label: "近 180 天" },
  { value: "365", label: "近一年" },
];

export const EMPTY_GROUP_VALUE = "未填写";
export const OTHER_GROUP_VALUE = "其他";

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function severityRank(value: Severity | null | undefined): number {
  return value ? SEVERITY_META[value].rank : -1;
}

export function maxSeverity(values: Array<Severity | null | undefined>): Severity | null {
  let best: Severity | null = null;
  for (const value of values) {
    if (value && severityRank(value) > severityRank(best)) {
      best = value;
    }
  }
  return best;
}

export function isRiskSeverity(value: Severity | null | undefined) {
  return value === "high" || value === "mid";
}

export function isFlaggedSeverity(value: Severity | null | undefined) {
  return value === "high" || value === "mid" || value === "watch";
}

export function followUpStatusOf(report: Pick<EnterpriseReportItem, "followUp">): FollowUpStatus {
  return report.followUp?.status || "pending";
}

export function isOpenAlert(report: Pick<EnterpriseReportItem, "severity" | "followUp">) {
  return isRiskSeverity(report.severity) && !FOLLOW_UP_META[followUpStatusOf(report)].closed;
}

/** 解析后端 ISO 时间（带 Z）；无效返回 null。 */
export function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? null : time;
}

/** 北京时间的年月，如 2026-10。 */
export function chinaMonthKey(value: string | null | undefined): string | null {
  const time = parseTime(value);
  if (time === null) {
    return null;
  }
  const china = new Date(time + CHINA_OFFSET_MS);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function chinaDateText(value: string | null | undefined): string {
  const time = parseTime(value);
  if (time === null) {
    return "-";
  }
  const china = new Date(time + CHINA_OFFSET_MS);
  return `${china.getUTCFullYear()}-${String(china.getUTCMonth() + 1).padStart(2, "0")}-${String(
    china.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function chinaDateTimeText(value: string | null | undefined): string {
  const time = parseTime(value);
  if (time === null) {
    return "-";
  }
  const china = new Date(time + CHINA_OFFSET_MS);
  return `${chinaDateText(value)} ${String(china.getUTCHours()).padStart(2, "0")}:${String(
    china.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export function periodStart(period: PeriodKey, now: number = Date.now()): number | null {
  if (period === "all") {
    return null;
  }
  return now - Number(period) * DAY_MS;
}

export function filterByPeriod<T extends { completedAt: string | null }>(
  items: T[],
  period: PeriodKey,
  now: number = Date.now(),
): T[] {
  const start = periodStart(period, now);
  if (start === null) {
    return items;
  }
  return items.filter((item) => {
    const time = parseTime(item.completedAt);
    return time !== null && time >= start;
  });
}

/** 每个填写者 × 量表只保留最近一次答卷（输入按时间升序或乱序均可）。 */
export function latestReports(reports: EnterpriseReportItem[]): EnterpriseReportItem[] {
  const latest = new Map<string, EnterpriseReportItem>();
  for (const report of reports) {
    const key = `${report.respondentKey}::${report.assessmentId}`;
    const current = latest.get(key);
    if (!current || (parseTime(report.completedAt) ?? 0) >= (parseTime(current.completedAt) ?? 0)) {
      latest.set(key, report);
    }
  }
  return [...latest.values()];
}

export interface ScopedDataset {
  reports: EnterpriseReportItem[];
  latest: EnterpriseReportItem[];
  respondents: EnterpriseRespondent[];
  severityByKey: Map<string, Severity | null>;
}

/** 按时间范围截取答卷，并按范围内的最近答卷重算每人的风险等级。 */
export function scopeDataset(dataset: EnterpriseDataset, period: PeriodKey, now: number = Date.now()): ScopedDataset {
  const reports = filterByPeriod(dataset.reports, period, now);
  const latest = latestReports(reports);
  const severityByKey = new Map<string, Severity | null>();
  for (const report of latest) {
    severityByKey.set(report.respondentKey, maxSeverity([severityByKey.get(report.respondentKey), report.severity]));
  }
  const respondents = dataset.respondents
    .filter((respondent) => severityByKey.has(respondent.key))
    .map((respondent) => ({ ...respondent, severity: severityByKey.get(respondent.key) ?? null }));
  return { reports, latest, respondents, severityByKey };
}

export interface SeverityCounts {
  high: number;
  mid: number;
  watch: number;
  ok: number;
  none: number;
  total: number;
}

export function countSeverities(items: Array<{ severity: Severity | null }>): SeverityCounts {
  const counts: SeverityCounts = { high: 0, mid: 0, watch: 0, ok: 0, none: 0, total: items.length };
  for (const item of items) {
    if (item.severity) {
      counts[item.severity] += 1;
    } else {
      counts.none += 1;
    }
  }
  return counts;
}

export function ratio(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  const percent = Math.round(value * 100 * 10 ** digits) / 10 ** digits;
  return `${percent}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return String(Math.round(value * 100) / 100);
}

export interface TrendPoint {
  key: string;
  label: string;
  reports: number;
  newRespondents: number;
  riskRate: number | null;
}

/** 最近 months 个自然月（北京时间）的答卷量、新增填写人数与风险检出率。 */
export function buildMonthlyTrend(
  reports: EnterpriseReportItem[],
  respondents: Array<Pick<EnterpriseRespondent, "firstAt">>,
  months = 6,
  now: number = Date.now(),
): TrendPoint[] {
  const china = new Date(now + CHINA_OFFSET_MS);
  const points: TrendPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(china.getUTCFullYear(), china.getUTCMonth() - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    points.push({ key, label: `${date.getUTCMonth() + 1}月`, reports: 0, newRespondents: 0, riskRate: null });
  }
  const byKey = new Map(points.map((point) => [point.key, point]));
  const graded = new Map<string, { graded: number; risk: number }>();
  for (const report of reports) {
    const key = chinaMonthKey(report.completedAt);
    const point = key ? byKey.get(key) : undefined;
    if (!point || !key) {
      continue;
    }
    point.reports += 1;
    if (report.severity) {
      const bucket = graded.get(key) || { graded: 0, risk: 0 };
      bucket.graded += 1;
      if (isRiskSeverity(report.severity)) {
        bucket.risk += 1;
      }
      graded.set(key, bucket);
    }
  }
  for (const respondent of respondents) {
    const key = chinaMonthKey(respondent.firstAt);
    const point = key ? byKey.get(key) : undefined;
    if (point) {
      point.newRespondents += 1;
    }
  }
  for (const point of points) {
    const bucket = graded.get(point.key);
    point.riskRate = bucket ? ratio(bucket.risk, bucket.graded) : null;
  }
  return points;
}

export function fieldValue(respondent: Pick<EnterpriseRespondent, "info">, fieldId: string): string {
  return (respondent.info?.[fieldId] || "").trim() || EMPTY_GROUP_VALUE;
}

/** 适合做分组对比的字段：优先选可选项类字段，其余按出现顺序。 */
export function groupableFields(fields: EnterpriseDataField[]): EnterpriseDataField[] {
  const preferred = ["category", "workLoc", "dept", "age", "gender", "edu", "livingStatus", "hasFamily", "post"];
  const excluded = new Set(["name", "empNo", "joinDate"]);
  const candidates = fields.filter((field) => !excluded.has(field.id));
  return [...candidates].sort((left, right) => {
    const leftIndex = preferred.indexOf(left.id);
    const rightIndex = preferred.indexOf(right.id);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
}

export interface GroupBucket<T> {
  value: string;
  items: T[];
}

/** 按字段取值分组，人数从多到少；超出 limit 的小组合并为“其他”。 */
export function groupRespondents<T extends Pick<EnterpriseRespondent, "info">>(
  respondents: T[],
  fieldId: string,
  limit = 12,
): GroupBucket<T>[] {
  const groups = new Map<string, T[]>();
  for (const respondent of respondents) {
    const value = fieldValue(respondent, fieldId);
    const list = groups.get(value) || [];
    list.push(respondent);
    groups.set(value, list);
  }
  const sorted = [...groups.entries()]
    .map(([value, items]) => ({ value, items }))
    .sort((left, right) => {
      if (left.value === EMPTY_GROUP_VALUE) return 1;
      if (right.value === EMPTY_GROUP_VALUE) return -1;
      return right.items.length - left.items.length || left.value.localeCompare(right.value, "zh-CN");
    });
  if (sorted.length <= limit) {
    return sorted;
  }
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).flatMap((group) => group.items);
  return [...head, { value: OTHER_GROUP_VALUE, items: rest }];
}

export interface MetricColumn {
  key: string;
  assessmentId: string;
  dimensionId: string | null;
  title: string;
  subtitle: string;
}

/** 分组对比的指标列：维度型量表按维度展开，其余按量表。 */
export function metricColumns(assessments: EnterpriseDataAssessment[], latest: EnterpriseReportItem[]): MetricColumn[] {
  const withData = new Set(latest.map((report) => report.assessmentId));
  const columns: MetricColumn[] = [];
  for (const assessment of assessments) {
    if (!withData.has(assessment.id) || assessment.resultType === "match") {
      continue;
    }
    if (assessment.resultType === "dimension" && assessment.dimensions.length > 0) {
      for (const dimension of assessment.dimensions) {
        columns.push({
          key: `${assessment.id}::${dimension.id}`,
          assessmentId: assessment.id,
          dimensionId: dimension.id,
          title: dimension.title,
          subtitle: assessment.title,
        });
      }
    } else {
      columns.push({
        key: assessment.id,
        assessmentId: assessment.id,
        dimensionId: null,
        title: assessment.title,
        subtitle: "总分",
      });
    }
  }
  return columns;
}

export interface MetricCell {
  n: number;
  flagged: number;
  flaggedRate: number | null;
  graded: number;
  avgScore: number | null;
}

export function metricCell(reports: EnterpriseReportItem[], column: MetricColumn): MetricCell {
  let n = 0;
  let flagged = 0;
  let graded = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const report of reports) {
    if (report.assessmentId !== column.assessmentId) {
      continue;
    }
    let severity: Severity | null;
    let score: number | null;
    if (column.dimensionId) {
      const dimension = report.dimensions.find((item) => item.id === column.dimensionId);
      if (!dimension) {
        continue;
      }
      severity = dimension.severity;
      score = dimension.score;
    } else {
      severity = report.severity;
      score = report.score;
    }
    n += 1;
    if (severity) {
      graded += 1;
      if (isFlaggedSeverity(severity)) {
        flagged += 1;
      }
    }
    if (typeof score === "number") {
      scoreSum += score;
      scoreCount += 1;
    }
  }
  return {
    n,
    flagged,
    graded,
    flaggedRate: graded > 0 ? flagged / graded : null,
    avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
  };
}

export interface GroupComparisonRow {
  value: string;
  count: number;
  risk: number;
  riskRate: number | null;
  severity: SeverityCounts;
  cells: Record<string, MetricCell>;
}

export function buildGroupComparison(
  respondents: EnterpriseRespondent[],
  latest: EnterpriseReportItem[],
  fieldId: string,
  columns: MetricColumn[],
  limit = 12,
): GroupComparisonRow[] {
  const reportsByKey = new Map<string, EnterpriseReportItem[]>();
  for (const report of latest) {
    const list = reportsByKey.get(report.respondentKey) || [];
    list.push(report);
    reportsByKey.set(report.respondentKey, list);
  }
  return groupRespondents(respondents, fieldId, limit).map((group) => {
    const reports = group.items.flatMap((respondent) => reportsByKey.get(respondent.key) || []);
    const severity = countSeverities(group.items);
    const graded = severity.total - severity.none;
    const risk = severity.high + severity.mid;
    const cells: Record<string, MetricCell> = {};
    for (const column of columns) {
      cells[column.key] = metricCell(reports, column);
    }
    return {
      value: group.value,
      count: group.items.length,
      risk,
      riskRate: ratio(risk, graded),
      severity,
      cells,
    };
  });
}

export interface LevelCount {
  level: string;
  count: number;
  severity: Severity | null;
}

function orderLevels(counts: Map<string, LevelCount>, preferred: string[]): LevelCount[] {
  const items = [...counts.values()];
  return items.sort((left, right) => {
    const leftIndex = preferred.indexOf(left.level);
    const rightIndex = preferred.indexOf(right.level);
    if (leftIndex >= 0 || rightIndex >= 0) {
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    }
    return severityRank(left.severity) - severityRank(right.severity) || right.count - left.count;
  });
}

export interface DimensionStats {
  id: string;
  title: string;
  n: number;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  flaggedRate: number | null;
  levels: LevelCount[];
}

export interface AssessmentStats {
  assessment: EnterpriseDataAssessment;
  n: number;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  levels: LevelCount[];
  severity: SeverityCounts;
  dimensions: DimensionStats[];
}

function scoreStats(values: number[]) {
  if (values.length === 0) {
    return { avgScore: null, minScore: null, maxScore: null };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    avgScore: sum / values.length,
    minScore: Math.min(...values),
    maxScore: Math.max(...values),
  };
}

export function buildAssessmentStats(assessment: EnterpriseDataAssessment, latest: EnterpriseReportItem[]): AssessmentStats {
  const reports = latest.filter((report) => report.assessmentId === assessment.id);
  const levelCounts = new Map<string, LevelCount>();
  const scores: number[] = [];
  for (const report of reports) {
    const level = report.level || (report.resultType === "dimension" ? "" : "未分级");
    if (level) {
      const entry = levelCounts.get(level) || { level, count: 0, severity: report.autoSeverity };
      entry.count += 1;
      levelCounts.set(level, entry);
    }
    if (typeof report.score === "number") {
      scores.push(report.score);
    }
  }
  const dimensions: DimensionStats[] = assessment.dimensions.map((dimension) => {
    const dimensionLevels = new Map<string, LevelCount>();
    const dimensionScores: number[] = [];
    let n = 0;
    let graded = 0;
    let flagged = 0;
    for (const report of reports) {
      const item = report.dimensions.find((entry) => entry.id === dimension.id);
      if (!item) {
        continue;
      }
      n += 1;
      if (typeof item.score === "number") {
        dimensionScores.push(item.score);
      }
      if (item.severity) {
        graded += 1;
        if (isFlaggedSeverity(item.severity)) {
          flagged += 1;
        }
      }
      const level = item.level || "未分级";
      const entry = dimensionLevels.get(level) || { level, count: 0, severity: item.severity };
      entry.count += 1;
      dimensionLevels.set(level, entry);
    }
    return {
      id: dimension.id,
      title: dimension.title,
      n,
      ...scoreStats(dimensionScores),
      flaggedRate: graded > 0 ? flagged / graded : null,
      levels: orderLevels(dimensionLevels, dimension.levels),
    };
  });
  return {
    assessment,
    n: reports.length,
    ...scoreStats(scores),
    levels: orderLevels(levelCounts, assessment.levels),
    severity: countSeverities(reports),
    dimensions,
  };
}

export interface Finding {
  tone: "risk" | "good" | "info";
  title: string;
  body: string;
}

export function buildFindings(input: {
  dataset: EnterpriseDataset;
  scoped: ScopedDataset;
  groupField: EnterpriseDataField | null;
  groupRows: GroupComparisonRow[];
  columns: MetricColumn[];
  overallCells: Record<string, MetricCell>;
}): Finding[] {
  const { dataset, scoped, groupField, groupRows, columns, overallCells } = input;
  const findings: Finding[] = [];
  const severity = countSeverities(scoped.respondents);
  const graded = severity.total - severity.none;
  const target = dataset.enterprise.personnelEmployeeCount;
  const coverage = target > 0 ? `，占人员表 ${target} 人的 ${formatPercent(ratio(scoped.respondents.length, target))}` : "";
  findings.push({
    tone: "info",
    title: `样本 ${scoped.respondents.length} 人 · 答卷 ${scoped.reports.length} 份`,
    body: `统计范围内共有 ${scoped.respondents.length} 名员工完成填写${coverage}；${
      severity.none > 0
        ? `${graded} 人的结果可按量表等级自动分级，另有 ${severity.none} 人填写的量表未区分风险等级、暂无法自动分级`
        : "所有人的结果均可按量表等级自动分级"
    }。`,
  });

  const risk = severity.high + severity.mid;
  if (risk > 0) {
    const open = scoped.reports.filter((report) => isOpenAlert(report)).length;
    findings.push({
      tone: "risk",
      title: `${risk} 人处于中高风险，需优先跟进`,
      body: `高风险 ${severity.high} 人、中度风险 ${severity.mid} 人，占可分级人数的 ${formatPercent(ratio(risk, graded))}；当前仍有 ${open} 份风险答卷未处理完毕。`,
    });
  } else if (graded > 0) {
    findings.push({
      tone: "good",
      title: "未发现中高风险个案",
      body: `可分级的 ${graded} 人中没有中度及以上风险，一般关注 ${severity.watch} 人，建议保持例行关怀与定期复测。`,
    });
  }

  const ranked = columns
    .map((column) => ({ column, cell: overallCells[column.key] }))
    .filter((item) => item.cell && item.cell.graded >= 3 && item.cell.flaggedRate !== null)
    .sort((left, right) => (right.cell.flaggedRate ?? 0) - (left.cell.flaggedRate ?? 0));
  if (ranked.length > 0 && (ranked[0].cell.flaggedRate ?? 0) > 0) {
    const top = ranked[0];
    findings.push({
      tone: "risk",
      title: `「${top.column.title}」是最突出的短板`,
      body: `${top.column.subtitle === "总分" ? top.column.title : `${top.column.subtitle} · ${top.column.title}`}中一般关注及以上的比例为 ${formatPercent(top.cell.flaggedRate)}（${top.cell.flagged}/${top.cell.graded}），平均分 ${formatScore(top.cell.avgScore)}。`,
    });
  }

  if (groupField) {
    const comparable = groupRows.filter(
      (row) => row.value !== EMPTY_GROUP_VALUE && row.value !== OTHER_GROUP_VALUE && row.count >= 3 && row.riskRate !== null,
    );
    if (comparable.length >= 2) {
      const sorted = [...comparable].sort((left, right) => (right.riskRate ?? 0) - (left.riskRate ?? 0));
      const worst = sorted[0];
      const best = sorted[sorted.length - 1];
      const overall = ratio(risk, graded);
      if ((worst.riskRate ?? 0) > 0) {
        findings.push({
          tone: "risk",
          title: `${groupField.label}「${worst.value}」需重点关注`,
          body: `该组 ${worst.count} 人中有 ${worst.risk} 人处于中高风险，比例 ${formatPercent(worst.riskRate)}，整体为 ${formatPercent(overall)}。`,
        });
      }
      if (best.value !== worst.value) {
        findings.push({
          tone: "good",
          title: `${groupField.label}「${best.value}」整体状态较好`,
          body: `该组 ${best.count} 人中风险比例 ${formatPercent(best.riskRate)}，可作为其他组的对标样本。`,
        });
      }
    }
  }

  const learning = dataset.learning;
  if (learning.totalViews > 0) {
    findings.push({
      tone: "info",
      title: `知识库累计学习 ${learning.totalViews} 次`,
      body: `${learning.learnerCount} 人参与图文阅读或音频练习，累计约 ${learning.totalMinutes} 分钟；其中 ${learning.linkedLearnerCount} 人已能对应到员工档案。`,
    });
  }
  return findings;
}

export interface ArchiveRow {
  key: string;
  respondent: EnterpriseRespondent | null;
  roster: EnterpriseRosterItem | null;
  displayName: string;
  empNo: string;
  username: string;
  status: RespondentStatus;
  severity: Severity | null;
  tags: string[];
  lastAt: string | null;
}

/** 员工档案行：已填写的人 + 人员表里尚未开始的人。 */
export function buildArchiveRows(dataset: EnterpriseDataset): ArchiveRow[] {
  const rosterByKey = new Map<string, EnterpriseRosterItem>();
  for (const person of dataset.roster) {
    rosterByKey.set(`p${person.personnelId}`, person);
  }
  const rows: ArchiveRow[] = dataset.respondents.map((respondent) => ({
    key: respondent.key,
    respondent,
    roster: rosterByKey.get(respondent.key) || null,
    displayName: respondent.displayName,
    empNo: respondent.empNo,
    username: respondent.personnel?.username || "",
    status: respondent.status,
    severity: respondent.severity,
    tags: respondent.tags,
    lastAt: respondent.lastAt,
  }));
  for (const person of dataset.roster) {
    if (person.respondentKey) {
      continue;
    }
    rows.push({
      key: `p${person.personnelId}`,
      respondent: null,
      roster: person,
      displayName: person.realName || person.username,
      empNo: person.empNo,
      username: person.username,
      status: "todo",
      severity: null,
      tags: [],
      lastAt: null,
    });
  }
  return rows;
}

export function matchesKeyword(row: ArchiveRow, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const haystack = [
    row.displayName,
    row.empNo,
    row.username,
    ...(row.respondent ? Object.values(row.respondent.info) : []),
    ...row.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

/** 本地应用跟进结果：答卷有效等级 = 人工调整 ?? 自动识别，并重算填写者等级。 */
export function applyFollowUp(dataset: EnterpriseDataset, publicId: string, followUp: EnterpriseFollowUp): EnterpriseDataset {
  const reports = dataset.reports.map((report) =>
    report.publicId === publicId
      ? { ...report, followUp, severity: followUp.severityOverride ?? report.autoSeverity }
      : report,
  );
  const target = reports.find((report) => report.publicId === publicId);
  if (!target) {
    return dataset;
  }
  const latestForRespondent = reports.filter(
    (report) => report.respondentKey === target.respondentKey && report.isLatest,
  );
  const respondents = dataset.respondents.map((respondent) =>
    respondent.key === target.respondentKey
      ? { ...respondent, severity: maxSeverity(latestForRespondent.map((report) => report.severity)) }
      : respondent,
  );
  return { ...dataset, reports, respondents };
}

export function tagColor(tag: string, groups: EnterpriseDataset["tagLibrary"]): string {
  return groups.find((group) => group.tags.includes(tag))?.color || "#6B6B6B";
}

export function tagUsage(respondents: Array<Pick<EnterpriseRespondent, "tags">>): Map<string, number> {
  const usage = new Map<string, number>();
  for (const respondent of respondents) {
    for (const tag of respondent.tags) {
      usage.set(tag, (usage.get(tag) || 0) + 1);
    }
  }
  return usage;
}
