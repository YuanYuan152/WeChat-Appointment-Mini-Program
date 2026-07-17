import type { AssessmentScoreResult } from "@/lib/api/types";

export function getResultSummary(result: AssessmentScoreResult): string {
  switch (result.type) {
    case "sum":
      return `${result.level}（${result.totalScore} 分）`;
    case "match":
      return result.title;
    case "dimension":
      if (result.summary) return result.summary;
      if (result.dimensions.length === 1) {
        const dim = result.dimensions[0];
        return `${dim.title}：${dim.level}`;
      }
      return result.dimensions.map((d) => `${d.title} ${d.level}`).join(" · ");
  }
}

export function formatReportTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
