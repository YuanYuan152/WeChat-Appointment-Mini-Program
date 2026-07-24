import type { AssessmentShareStatsFilters } from "@/types/assessmentShareStats";

export function formatAssessmentConversionRate(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }
  return `${(value * 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  })}%`;
}

export function buildAssessmentShareStatsQuery(
  filters: AssessmentShareStatsFilters,
) {
  const params = new URLSearchParams();
  setTrimmedParam(params, "assessment_id", filters.assessmentId);
  setTrimmedParam(params, "start_at", filters.startAt);
  setTrimmedParam(params, "end_at", filters.endAt);
  return params.toString();
}

function setTrimmedParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const normalized = value?.trim();
  if (normalized) {
    params.set(key, normalized);
  }
}
