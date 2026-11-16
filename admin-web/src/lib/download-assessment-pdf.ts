import { saveCanvasPdf, type CanvasPdfBlock } from "@/lib/canvas-pdf";
import type {
  AssessmentDefinition,
  AssessmentQuestion,
  AssessmentScoreRange,
  AssessmentSourceReport,
} from "@/types/assessment";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * 下载量表：连续生成两份 PDF。
 * 1. 题目卷：量表名称、引导语、题目（供来访线下作答）
 * 2. 结果卷：各分档计分结果说明
 */
export async function downloadAssessmentPdfs(definition: AssessmentDefinition): Promise<void> {
  const title = definition.title?.trim() || "未命名量表";
  await saveCanvasPdf({
    filename: `${title}-题目`,
    pageTitle: title,
    blocks: buildAssessmentQuestionsPdfBlocks(definition),
  });
  // 浏览器连续触发两次下载时，短暂停顿可提高第二次成功概率
  await wait(400);
  await saveCanvasPdf({
    filename: `${title}-结果`,
    pageTitle: `${title} · 计分结果`,
    blocks: buildAssessmentResultsPdfBlocks(definition),
  });
}

export function buildAssessmentQuestionsPdfBlocks(
  definition: AssessmentDefinition,
): CanvasPdfBlock[] {
  const title = definition.title?.trim() || "未命名量表";
  const instructions = definition.instructions?.trim() || "（暂无引导语）";
  const blocks: CanvasPdfBlock[] = [
    { type: "text", text: title, fontSize: 40, bold: true, gapAfter: 18 },
    { type: "text", text: "引导语", fontSize: 28, bold: true, gapBefore: 8, gapAfter: 10 },
    { type: "text", text: instructions, fontSize: 24, gapAfter: 24 },
    { type: "text", text: "题目", fontSize: 28, bold: true, gapBefore: 4, gapAfter: 14 },
  ];

  const questions = definition.questions || [];
  if (questions.length === 0) {
    blocks.push({ type: "text", text: "（暂无题目）", fontSize: 24 });
    return blocks;
  }

  questions.forEach((question, index) => {
    blocks.push({
      type: "text",
      text: formatQuestionForVisitor(question, index + 1),
      fontSize: 24,
      gapAfter: 16,
    });
  });

  return blocks;
}

export function buildAssessmentResultsPdfBlocks(
  definition: AssessmentDefinition,
): CanvasPdfBlock[] {
  const title = definition.title?.trim() || "未命名量表";
  const blocks: CanvasPdfBlock[] = [
    { type: "text", text: `${title} · 计分结果`, fontSize: 36, bold: true, gapAfter: 12 },
    {
      type: "text",
      text: `计分方式：${scoringTypeLabel(definition.scoringType)}`,
      fontSize: 24,
      gapAfter: 22,
    },
  ];

  const sourceReports = definition.sourceReports || [];
  if (sourceReports.length > 0) {
    sourceReports.forEach((report, index) => {
      blocks.push({
        type: "text",
        text: `来源量表 ${index + 1}：${report.sourceTitle || report.sourceId}`,
        fontSize: 28,
        bold: true,
        gapBefore: index === 0 ? 0 : 18,
        gapAfter: 10,
      });
      blocks.push(...buildSourceReportResultBlocks(report));
    });
    return blocks;
  }

  blocks.push(...buildPrimaryResultBlocks(definition));
  return blocks;
}

function buildPrimaryResultBlocks(definition: AssessmentDefinition): CanvasPdfBlock[] {
  const blocks: CanvasPdfBlock[] = [];
  const scoringType = definition.scoringType;

  if (scoringType === "match") {
    const matches = definition.matchResults || [];
    blocks.push(sectionTitle("匹配结果"));
    if (matches.length === 0) {
      blocks.push(emptyLine("暂无匹配结果配置"));
    } else {
      matches.forEach((item, index) => {
        blocks.push({
          type: "text",
          text: [
            `${index + 1}. ${item.title || "未命名结果"}`,
            item.description?.trim() || "（暂无说明）",
            ...(item.suggestions || []).filter(Boolean).map((line) => `建议：${line}`),
          ].join("\n"),
          fontSize: 23,
          gapAfter: 14,
        });
      });
    }
    appendReportProfiles(blocks, definition);
    return blocks;
  }

  if (scoringType === "dimension" || (definition.dimensions || []).length > 0) {
    const dimensions = definition.dimensions || [];
    blocks.push(sectionTitle("维度分档结果"));
    if (dimensions.length === 0) {
      blocks.push(emptyLine("暂无维度配置"));
    } else {
      dimensions.forEach((dimension, index) => {
        blocks.push({
          type: "text",
          text: `${index + 1}. ${dimension.title || "未命名维度"}`,
          fontSize: 26,
          bold: true,
          gapBefore: 8,
          gapAfter: 8,
        });
        if (dimension.intro?.trim()) {
          blocks.push({
            type: "text",
            text: dimension.intro.trim(),
            fontSize: 22,
            color: "#5c564e",
            gapAfter: 8,
          });
        }
        blocks.push(...formatScoreRanges(dimension.scoreRanges || []));
      });
    }

    if (definition.totalScore) {
      blocks.push(sectionTitle(definition.totalScore.title?.trim() || "总分结果"));
      if (definition.totalScore.intro?.trim()) {
        blocks.push({
          type: "text",
          text: definition.totalScore.intro.trim(),
          fontSize: 22,
          color: "#5c564e",
          gapAfter: 8,
        });
      }
      blocks.push(...formatScoreRanges(definition.totalScore.scoreRanges || []));
    }
    appendReportProfiles(blocks, definition);
    return blocks;
  }

  blocks.push(sectionTitle("总分分档结果"));
  blocks.push(...formatScoreRanges(definition.scoreRanges || []));
  appendReportProfiles(blocks, definition);
  return blocks;
}

function buildSourceReportResultBlocks(report: AssessmentSourceReport): CanvasPdfBlock[] {
  const blocks: CanvasPdfBlock[] = [
    {
      type: "text",
      text: `计分方式：${scoringTypeLabel(report.scoringType)}`,
      fontSize: 22,
      gapAfter: 10,
    },
  ];

  if (report.scoringType === "match") {
    const profiles = report.reportProfiles || [];
    const matches = report.matchResults || [];
    if (matches.length > 0) {
      matches.forEach((item, index) => {
        blocks.push({
          type: "text",
          text: [
            `${index + 1}. ${item.title || "未命名结果"}`,
            item.description?.trim() || "（暂无说明）",
          ].join("\n"),
          fontSize: 22,
          gapAfter: 12,
        });
      });
    } else if (profiles.length > 0) {
      profiles.forEach((item, index) => {
        blocks.push({
          type: "text",
          text: [
            `${index + 1}. ${item.title || "未命名结果"}`,
            item.description?.trim() || "（暂无说明）",
          ].join("\n"),
          fontSize: 22,
          gapAfter: 12,
        });
      });
    } else {
      blocks.push(emptyLine("暂无匹配结果配置"));
    }
    return blocks;
  }

  if ((report.dimensions || []).length > 0) {
    (report.dimensions || []).forEach((dimension, index) => {
      blocks.push({
        type: "text",
        text: `${index + 1}. ${dimension.title || "未命名维度"}`,
        fontSize: 24,
        bold: true,
        gapBefore: 6,
        gapAfter: 6,
      });
      blocks.push(...formatScoreRanges(dimension.scoreRanges || []));
    });
    return blocks;
  }

  blocks.push(...formatScoreRanges(report.scoreRanges || []));
  return blocks;
}

function appendReportProfiles(blocks: CanvasPdfBlock[], definition: AssessmentDefinition) {
  const profiles = definition.reportProfiles || [];
  if (profiles.length === 0) return;
  blocks.push(sectionTitle("报告画像"));
  profiles.forEach((item, index) => {
    blocks.push({
      type: "text",
      text: [
        `${index + 1}. ${item.title || "未命名画像"}`,
        item.description?.trim() || "（暂无说明）",
        ...(item.suggestions || []).filter(Boolean).map((line) => `建议：${line}`),
      ].join("\n"),
      fontSize: 23,
      gapAfter: 12,
    });
  });
}

function formatScoreRanges(ranges: AssessmentScoreRange[]): CanvasPdfBlock[] {
  if (!ranges.length) {
    return [emptyLine("暂无分档结果配置")];
  }
  return ranges.map((range, index) => ({
    type: "text" as const,
    text: [
      `${index + 1}. ${range.level?.trim() || "未命名档位"}（${formatBound(range.min)} ~ ${formatBound(range.max)}）`,
      `面向来访：${range.visitorDescription?.trim() || "（暂无）"}`,
      `面向分析：${range.analystDescription?.trim() || "（暂无）"}`,
      ...(range.suggestions || []).filter(Boolean).map((line) => `建议：${line}`),
    ].join("\n"),
    fontSize: 23,
    gapAfter: 12,
  }));
}

function formatQuestionForVisitor(question: AssessmentQuestion, ordinal: number): string {
  const inputType = question.inputType || "choice";
  const lines: string[] = [`${ordinal}. ${question.text?.trim() || "（无题干）"}`];
  if (question.helpText?.trim()) {
    lines.push(`说明：${question.helpText.trim()}`);
  }

  if (inputType === "text") {
    lines.push("作答：____________________");
    return lines.join("\n");
  }
  if (inputType === "number") {
    lines.push("作答：________");
    return lines.join("\n");
  }

  const options = question.options || [];
  if (options.length === 0) {
    lines.push("（暂无选项）");
    return lines.join("\n");
  }

  options.forEach((option, index) => {
    const letter = OPTION_LETTERS[index] || String(index + 1);
    const followUp = option.followUp
      ? `　追问：${option.followUp.label?.trim() || "请填写"} ____________________`
      : "";
    lines.push(`${letter}. ${option.text?.trim() || "（无选项文案）"}${followUp}`);
  });
  return lines.join("\n");
}

function scoringTypeLabel(type: AssessmentDefinition["scoringType"]): string {
  const labels: Record<AssessmentDefinition["scoringType"], string> = {
    sum: "总分",
    dimension: "维度",
    match: "匹配",
    aas: "AAS 固定计分",
    psqi: "PSQI 固定计分",
    pbi: "PBI 固定计分",
    cbcl: "CBCL 固定计分",
    "dark-light": "暗黑人格固定计分",
  };
  return labels[type] || type;
}

function formatBound(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "—" : String(value);
}

function sectionTitle(text: string): CanvasPdfBlock {
  return { type: "text", text, fontSize: 28, bold: true, gapBefore: 10, gapAfter: 10 };
}

function emptyLine(text: string): CanvasPdfBlock {
  return { type: "text", text, fontSize: 23, color: "#7a7268", gapAfter: 12 };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
