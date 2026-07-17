export const STAR_COUNT = 5;

export const GOAL_SCORE_HINTS: Record<number, string> = {
  1: "未达成",
  3: "达成了一部分",
  5: "已完全达成",
};

export const RHYTHM_SCORE_HINTS: Record<number, string> = {
  1: "完全不契合",
  3: "基本契合",
  5: "高度契合",
};

export const IMPROVEMENT_OPTIONS = [
  "咨询室的隔音与私密性",
  "空间布置（如灯光、座椅、温度等）",
  "预约流程的便捷程度（如改约、提醒）",
  "咨询频率、时长的弹性安排",
  "费用支付或接待指引",
  "暂无需要改进的地方",
] as const;

export const GOAL_QUESTION =
  "对照你最初来到咨询室时的期望或目标，你认为目前的达成情况如何？";

export const RHYTHM_QUESTION =
  "在咨询过程中，你觉得探讨的议题和节奏是否契合你的需要？";

export const IMPROVEMENT_QUESTION =
  "在整体体验中，你认为以下哪些方面最需要我们改进？";

export const NONE_IMPROVEMENT = "暂无需要改进的地方";

export function goalScoreHint(score: number): string {
  return GOAL_SCORE_HINTS[score] || "";
}

export function rhythmScoreHint(score: number): string {
  return RHYTHM_SCORE_HINTS[score] || "";
}
