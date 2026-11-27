import type { DemographicQuestion, DemographicValue } from "@/lib/api/types";

/** 未填写：空值、空字符串（含只有空格）、空数组。 */
export function isDemographicValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/** 与后端 _same_scalar 一致：布尔只和布尔相等，数字按数值相等，其它要求类型一致。 */
export function sameDemographicValue(left: unknown, right: DemographicValue): boolean {
  if (typeof left === "boolean" || typeof right === "boolean") {
    return typeof left === "boolean" && typeof right === "boolean" && left === right;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left === right;
  }
  return typeof left === typeof right && left === right;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * 已填写但不合规时的提示（与后端 validate_submission_answers 的人口学校验一致）；
 * 未填写或已合规时返回空字符串。
 */
export function demographicValueIssue(question: DemographicQuestion, value: unknown): string {
  if (isDemographicValueEmpty(value)) return "";
  const options = question.options ?? [];
  switch (question.inputType) {
    case "single":
      if (!options.some((option) => sameDemographicValue(value, option.value))) {
        return "请选择有效的选项";
      }
      break;
    case "multiple": {
      if (!Array.isArray(value)) return "请选择有效的选项";
      if (value.some((item) => !options.some((option) => sameDemographicValue(item, option.value)))) {
        return "包含无效的选项";
      }
      if (new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
        return "选项不能重复";
      }
      break;
    }
    case "text":
      if (typeof value !== "string") return "请填写文字";
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return "请填写有效的数字";
      break;
    case "date":
      if (typeof value !== "string" || !isIsoDate(value)) return "请选择有效的日期";
      break;
    default:
      return "暂不支持该题型";
  }

  const validation = question.validation ?? {};
  if (typeof value === "number") {
    if (validation.min != null && value < Number(validation.min)) {
      return `不能小于 ${validation.min}`;
    }
    if (validation.max != null && value > Number(validation.max)) {
      return `不能大于 ${validation.max}`;
    }
  }
  if (typeof value === "string" || Array.isArray(value)) {
    const unit = typeof value === "string" ? "个字" : "项";
    const verb = typeof value === "string" ? "填写" : "选择";
    if (validation.minLength != null && value.length < Number(validation.minLength)) {
      return `至少${verb} ${validation.minLength} ${unit}`;
    }
    if (validation.maxLength != null && value.length > Number(validation.maxLength)) {
      return `最多${verb} ${validation.maxLength} ${unit}`;
    }
  }
  if (validation.pattern && typeof value === "string") {
    try {
      if (!new RegExp(`^(?:${validation.pattern})$`).test(value)) return "格式不正确";
    } catch {
      // 规则在浏览器里无法解析时交给服务端校验
    }
  }
  return "";
}

/** 必填题都已填写，且已填写的都合规。 */
export function areDemographicAnswersComplete(
  questions: DemographicQuestion[],
  answers: Record<string, unknown> | undefined,
): boolean {
  const values = answers ?? {};
  return questions.every((question) => {
    const value = values[question.id];
    if (isDemographicValueEmpty(value)) return !question.required;
    return demographicValueIssue(question, value) === "";
  });
}

/** 提交前整理：只保留本量表的人口学题，去掉未填写的值。 */
export function cleanDemographicAnswers(
  questions: DemographicQuestion[],
  answers: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const values = answers ?? {};
  const cleaned: Record<string, unknown> = {};
  for (const question of questions) {
    const value = values[question.id];
    if (!isDemographicValueEmpty(value)) {
      cleaned[question.id] = value;
    }
  }
  return cleaned;
}
