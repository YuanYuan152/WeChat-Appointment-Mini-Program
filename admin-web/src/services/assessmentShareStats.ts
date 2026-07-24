import { apiRequest } from "@/lib/api";
import { buildAssessmentShareStatsQuery } from "@/lib/assessmentShareStats";
import type {
  AssessmentShareStats,
  AssessmentShareStatsFilters,
} from "@/types/assessmentShareStats";

const ASSESSMENT_SHARE_STATS_PATH =
  "/api/mini/admin/assessment-share-stats";

export function fetchAssessmentShareStats(
  filters: AssessmentShareStatsFilters,
) {
  const query = buildAssessmentShareStatsQuery(filters);

  return apiRequest<AssessmentShareStats>(
    `${ASSESSMENT_SHARE_STATS_PATH}${query ? `?${query}` : ""}`,
  );
}
