import type {
  AssessmentDefinition,
  AssessmentDemographicOption,
  AssessmentDemographicQuestion,
  AssessmentDemographicValue,
  AssessmentScoreRange,
} from "@/types/assessment";
import type { AssessmentReportSnapshot } from "@/types/assessmentReport";

export type ChinaDayBoundary = "start" | "end";

export interface ChinaDateFilterRange {
  startAt?: string;
  endAt?: string;
}

export interface ScoreRangeBounds {
  min: number;
  max: number;
}

export interface SnapshotAnswerDisplay {
  questionId: string;
  questionText: string;
  selectedOptionId: string | null;
  answerText: string;
  scoreValue: number | null;
}

export interface SnapshotDemographicAnswerDisplay {
  questionId: string;
  questionText: string;
  inputType: AssessmentDemographicQuestion["inputType"];
  answerText: string;
}

export interface AssessmentReportAnswerRow {
  id: string;
  label: string;
  value: string;
}

export interface AssessmentAssetUrlOptions {
  /**
   * The value injected from NEXT_PUBLIC_EAP_BASE_URL by the caller.
   *
   * Keeping it as an argument makes this helper usable during SSR and in tests
   * without reading `window` or process state.
   */
  eapBaseUrl?: string | null;
  /**
   * A browser origin supplied by the caller when EAP should use the same host.
   * For example: `location.origin`.
   */
  sameOriginBaseUrl?: string | null;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_SCORE_BOUNDS: ScoreRangeBounds = { min: 0, max: 100 };
const EMPTY_ANSWER_TEXT = "未作答";
const EMPTY_DEMOGRAPHIC_TEXT = "未填写";

function parseDateOnly(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const verificationDate = new Date(Date.UTC(year, month - 1, day));
  if (
    verificationDate.getUTCFullYear() !== year ||
    verificationDate.getUTCMonth() !== month - 1 ||
    verificationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * Convert a date-only filter to the corresponding day boundary in China
 * Standard Time (UTC+08:00), serialized as an ISO UTC timestamp.
 */
export function toChinaDayBoundaryIso(
  value: string | null | undefined,
  boundary: ChinaDayBoundary,
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = parseDateOnly(normalized);
  if (!parsed) {
    return undefined;
  }

  const timestamp =
    boundary === "start"
      ? Date.UTC(parsed.year, parsed.month - 1, parsed.day, -8, 0, 0, 0)
      : Date.UTC(parsed.year, parsed.month - 1, parsed.day, 15, 59, 59, 999);
  return new Date(timestamp).toISOString();
}

/** Backwards-compatible name used by the report query screen. */
export const toAssessmentReportDateBoundary = toChinaDayBoundaryIso;

export function buildChinaDateFilterRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ChinaDateFilterRange {
  const startAt = toChinaDayBoundaryIso(startDate, "start");
  const endAt = toChinaDayBoundaryIso(endDate, "end");

  return {
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
  };
}

export function getScoreRangeBounds(
  ranges: readonly AssessmentScoreRange[] | null | undefined,
): ScoreRangeBounds {
  const validRanges = (ranges ?? []).filter(
    (range) => Number.isFinite(range.min) && Number.isFinite(range.max),
  );
  if (validRanges.length === 0) {
    return { ...DEFAULT_SCORE_BOUNDS };
  }

  return {
    min: Math.min(...validRanges.map((range) => range.min)),
    max: Math.max(...validRanges.map((range) => range.max)),
  };
}

export function getScoreRangeMin(
  ranges: readonly AssessmentScoreRange[] | null | undefined,
): number {
  return getScoreRangeBounds(ranges).min;
}

export function getScoreRangeMax(
  ranges: readonly AssessmentScoreRange[] | null | undefined,
): number {
  return getScoreRangeBounds(ranges).max;
}

export const getAssessmentRangeMax = getScoreRangeMax;

function mapAssessmentAnswerDisplays(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, string>> | null | undefined,
): SnapshotAnswerDisplay[] {
  return assessment.questions.map((question) => {
    const selectedOptionId = answers?.[question.id] ?? null;
    const selectedOption = selectedOptionId
      ? question.options.find((option) => option.id === selectedOptionId)
      : undefined;

    return {
      questionId: question.id,
      questionText: question.text,
      selectedOptionId,
      answerText:
        selectedOption?.text ??
        (selectedOptionId
          ? `未知选项（${selectedOptionId}）`
          : EMPTY_ANSWER_TEXT),
      scoreValue: selectedOption?.value ?? null,
    };
  });
}

/**
 * Resolve submitted option IDs against the immutable definition embedded in
 * the report snapshot. Current assessment definitions must not be passed in.
 */
export function mapSnapshotAnswers(
  snapshot: Readonly<AssessmentReportSnapshot>,
  answers: Readonly<Record<string, string>> | null | undefined,
): SnapshotAnswerDisplay[] {
  return mapAssessmentAnswerDisplays(snapshot.assessment, answers);
}

/**
 * Compact rows for the report UI. The caller must pass
 * `reportSnapshot.assessment`, never a freshly loaded definition.
 */
export function mapAssessmentAnswers(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, string>> | null | undefined,
): AssessmentReportAnswerRow[] {
  return mapAssessmentAnswerDisplays(assessment, answers).map((row) => ({
    id: row.questionId,
    label: row.questionText,
    value: row.answerText,
  }));
}

function scalarEquals(
  left: unknown,
  right: AssessmentDemographicValue,
): boolean {
  if (typeof left === "boolean" || typeof right === "boolean") {
    return (
      typeof left === "boolean" &&
      typeof right === "boolean" &&
      left === right
    );
  }
  if (typeof left === "number" && typeof right === "number") {
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
  }
  return typeof left === typeof right && left === right;
}

function findDemographicOption(
  options: readonly AssessmentDemographicOption[] | undefined,
  value: unknown,
): AssessmentDemographicOption | undefined {
  return options?.find(
    (option) => option.id === value || scalarEquals(value, option.value),
  );
}

function isEmptyDemographicValue(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : EMPTY_DEMOGRAPHIC_TEXT;
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (Array.isArray(value)) {
    return value.map(formatUnknownValue).join("、");
  }
  if (value == null) {
    return EMPTY_DEMOGRAPHIC_TEXT;
  }

  try {
    return JSON.stringify(value) || EMPTY_DEMOGRAPHIC_TEXT;
  } catch {
    return EMPTY_DEMOGRAPHIC_TEXT;
  }
}

function formatDemographicAnswer(
  question: AssessmentDemographicQuestion,
  value: unknown,
): string {
  if (isEmptyDemographicValue(value)) {
    return EMPTY_DEMOGRAPHIC_TEXT;
  }

  if (question.inputType === "multiple" && Array.isArray(value)) {
    return value
      .map(
        (item) =>
          findDemographicOption(question.options, item)?.text ??
          formatUnknownValue(item),
      )
      .join("、");
  }

  if (question.inputType === "single") {
    return (
      findDemographicOption(question.options, value)?.text ??
      formatUnknownValue(value)
    );
  }

  return formatUnknownValue(value);
}

function mapDemographicAnswerDisplays(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): SnapshotDemographicAnswerDisplay[] {
  return (assessment.demographicQuestions ?? []).map((question) => ({
    questionId: question.id,
    questionText: question.text,
    inputType: question.inputType,
    answerText: formatDemographicAnswer(question, answers?.[question.id]),
  }));
}

/**
 * Render demographic answers from the immutable snapshot definition. Values
 * are stored as option values (not IDs), while ID matching is retained for
 * compatibility with early report data.
 */
export function mapSnapshotDemographicAnswers(
  snapshot: Readonly<AssessmentReportSnapshot>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): SnapshotDemographicAnswerDisplay[] {
  return mapDemographicAnswerDisplays(snapshot.assessment, answers);
}

/**
 * Compact demographic rows for the report UI. The definition argument is the
 * immutable assessment object stored inside the report snapshot.
 */
export function mapDemographicAnswers(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): AssessmentReportAnswerRow[] {
  return mapDemographicAnswerDisplays(assessment, answers).map((row) => ({
    id: row.questionId,
    label: row.questionText,
    value: row.answerText,
  }));
}

function isAbsoluteAssetUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /^data:/i.test(value) ||
    /^blob:/i.test(value) ||
    value.startsWith("//")
  );
}

function normalizeAbsoluteBaseUrl(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function resolveAssetBaseUrl(
  options: AssessmentAssetUrlOptions,
): string | undefined {
  const absoluteEapBase = normalizeAbsoluteBaseUrl(options.eapBaseUrl);
  if (absoluteEapBase) {
    return absoluteEapBase;
  }

  const sameOriginBase = normalizeAbsoluteBaseUrl(options.sameOriginBaseUrl);
  if (!sameOriginBase) {
    return undefined;
  }

  const relativeEapBase = options.eapBaseUrl?.trim();
  if (!relativeEapBase) {
    return sameOriginBase;
  }

  try {
    return new URL(relativeEapBase, sameOriginBase).toString();
  } catch {
    return sameOriginBase;
  }
}

/**
 * Resolve an assessment image without touching browser globals.
 *
 * Callers can pass `process.env.NEXT_PUBLIC_EAP_BASE_URL` and, in a client
 * component, an optional same-origin base. Without either base, relative URLs
 * remain relative so the browser naturally resolves them against the current
 * origin.
 */
export function resolveAssessmentAssetUrl(
  value: string | null | undefined,
  optionsOrEapBaseUrl: AssessmentAssetUrlOptions | string | null = {},
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized || isAbsoluteAssetUrl(normalized)) {
    return normalized;
  }

  const options =
    typeof optionsOrEapBaseUrl === "string" || optionsOrEapBaseUrl === null
      ? { eapBaseUrl: optionsOrEapBaseUrl }
      : optionsOrEapBaseUrl;
  const baseUrl = resolveAssetBaseUrl(options);
  if (!baseUrl) {
    return normalized;
  }

  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
}
