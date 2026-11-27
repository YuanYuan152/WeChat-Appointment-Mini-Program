import type {
  AssessmentDefinition,
  AssessmentDemographicOption,
  AssessmentDemographicQuestion,
  AssessmentDemographicValue,
  AssessmentOption,
  AssessmentOptionFollowUp,
  AssessmentQuestion,
  AssessmentScoreRange,
} from "@/types/assessment";
import type { AssessmentReportSnapshot } from "@/types/assessmentReport";
import { compileDimensionFormula } from "@/lib/assessmentFormula";

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
  /** 选择题第一个选中的选项（多选题看 answerText） */
  selectedOptionId: string | null;
  answerText: string;
  /** 本题得分（多选题为题内计分结果；未作答或选项已失效为 null） */
  scoreValue: number | null;
  /** 得分说明：如“3 分”“题内计分 3 分”“不计分”；未作答为空 */
  scoreText: string;
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
  /** 本题得分说明，人口学信息没有 */
  score?: string;
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
   * API origin used for `/static/assessments/` and managed
   * `/static/assessment-assets/` uploads.
   */
  apiBaseUrl?: string | null;
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
const MAX_ASSESSMENT_ASSET_REFERENCE_LENGTH = 500;
const ASSESSMENT_ASSET_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const ASSESSMENT_UPLOAD_PATH_PATTERN =
  /^\/static\/assessment-assets\/[0-9a-f]{64}\.(?:jpg|png|webp)$/;
const SAFE_ASSESSMENT_ASSET_PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/;
const LEGACY_ASSESSMENT_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

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
    (range): range is AssessmentScoreRange & { min: number; max: number } =>
      typeof range.min === "number" && typeof range.max === "number",
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

interface ChoiceAnswerEntry {
  optionId: string;
  followUp?: unknown;
}

function parseChoiceAnswerEntry(entry: unknown): ChoiceAnswerEntry | null {
  if (typeof entry === "string") {
    return { optionId: entry };
  }
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const record = entry as { optionId?: unknown; followUp?: unknown };
    if (typeof record.optionId === "string") {
      return { optionId: record.optionId, followUp: record.followUp };
    }
  }
  return null;
}

function isMultipleAnswerQuestion(question: Readonly<AssessmentQuestion>): boolean {
  return (question.inputType || "choice") === "choice" && question.multiple === true;
}

function isEmptyAnswer(answer: unknown): boolean {
  return answer == null || answer === "" || (Array.isArray(answer) && answer.length === 0);
}

/** 选择题本次作答的选项条目：单选一个，多选全部列出。 */
function choiceAnswerEntries(
  question: Readonly<AssessmentQuestion>,
  answer: unknown,
): ChoiceAnswerEntry[] {
  if (isEmptyAnswer(answer)) {
    return [];
  }
  const raw = isMultipleAnswerQuestion(question) && Array.isArray(answer) ? answer : [answer];
  return raw
    .map(parseChoiceAnswerEntry)
    .filter((entry): entry is ChoiceAnswerEntry => entry !== null);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isFilledTextValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isFilledNumberValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function followUpScore(followUp: AssessmentOptionFollowUp, value: unknown): number {
  const completed = finiteOr(followUp.completedScore, 0);
  const empty = finiteOr(followUp.emptyScore, 0);
  const filled =
    followUp.inputType === "text" ? isFilledTextValue(value) : isFilledNumberValue(value);
  if (followUp.scoreMode === "value") {
    return isFilledNumberValue(value) ? value : empty;
  }
  return filled ? completed : empty;
}

function optionScore(option: AssessmentOption, entry: ChoiceAnswerEntry): number {
  return option.value + (option.followUp ? followUpScore(option.followUp, entry.followUp) : 0);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 按作答计算单题得分，与后端计分口径一致（不含维度里的反向计分）：
 * 单选取选项分值 + 追问得分；多选开启题内计分时按相加 / 公式计算，未开启时不计分（0）；
 * 填空、数字按是否填写或填写的数字计分。未作答或选项已失效返回 null。
 */
export function computeQuestionScore(
  question: Readonly<AssessmentQuestion>,
  answer: unknown,
): number | null {
  if (isEmptyAnswer(answer)) {
    return null;
  }
  const inputType = question.inputType || "choice";
  const completed = finiteOr(question.completedScore, 0);
  const empty = finiteOr(question.emptyScore, 0);
  if (inputType === "text") {
    const text = typeof answer === "object" ? (answer as { text?: unknown }).text : undefined;
    return isFilledTextValue(text) ? completed : empty;
  }
  if (inputType === "number") {
    const number = typeof answer === "object" ? (answer as { number?: unknown }).number : undefined;
    if ((question.scoreMode || "filled") === "value") {
      return isFilledNumberValue(number) ? number : empty;
    }
    return isFilledNumberValue(number) ? completed : empty;
  }
  const options = new Map(question.options.map((option) => [option.id, option]));
  const entries = choiceAnswerEntries(question, answer);
  if (isMultipleAnswerQuestion(question)) {
    const config = question.innerScoring;
    if (!config) {
      return 0;
    }
    const contributions: Record<string, number> = {};
    for (const entry of entries) {
      const option = options.get(entry.optionId);
      if (option) {
        contributions[option.id] = optionScore(option, entry);
      }
    }
    if (config.mode === "formula") {
      try {
        return roundScore(
          compileDimensionFormula(
            config.formula ?? "",
            question.options.map((option) => option.id),
          ).evaluate(contributions),
        );
      } catch {
        return null;
      }
    }
    return roundScore(Object.values(contributions).reduce((total, value) => total + value, 0));
  }
  const entry = entries[0];
  const option = entry ? options.get(entry.optionId) : undefined;
  return entry && option ? optionScore(option, entry) : null;
}

function followUpText(option: AssessmentOption, value: unknown): string {
  if (!option.followUp || value == null || value === "") {
    return "";
  }
  return `（${option.followUp.label || "补充"}：${String(value)}）`;
}

/** 作答的可读文字：选项文字（含追问内容）、填写的文字或数字。 */
export function describeQuestionAnswer(
  question: Readonly<AssessmentQuestion>,
  answer: unknown,
): string {
  if (isEmptyAnswer(answer)) {
    return EMPTY_ANSWER_TEXT;
  }
  const inputType = question.inputType || "choice";
  if (inputType === "text") {
    const text = typeof answer === "object" ? (answer as { text?: unknown }).text : undefined;
    return isFilledTextValue(text) ? text : EMPTY_ANSWER_TEXT;
  }
  if (inputType === "number") {
    const number = typeof answer === "object" ? (answer as { number?: unknown }).number : undefined;
    return isFilledNumberValue(number) ? String(number) : EMPTY_ANSWER_TEXT;
  }
  const entries = choiceAnswerEntries(question, answer);
  if (entries.length === 0) {
    return EMPTY_ANSWER_TEXT;
  }
  return entries
    .map((entry) => {
      const option = question.options.find((item) => item.id === entry.optionId);
      return option
        ? `${option.text || option.id}${followUpText(option, entry.followUp)}`
        : `未知选项（${entry.optionId}）`;
    })
    .join("、");
}

function questionScoreText(
  question: Readonly<AssessmentQuestion>,
  answer: unknown,
  score: number | null,
): string {
  if (isEmptyAnswer(answer)) {
    return "";
  }
  if (isMultipleAnswerQuestion(question)) {
    if (!question.innerScoring) {
      return "不计分";
    }
    return score === null ? "" : `题内计分 ${score} 分`;
  }
  return score === null ? "" : `${score} 分`;
}

function mapAssessmentAnswerDisplays(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): SnapshotAnswerDisplay[] {
  return assessment.questions.map((question) => {
    const answer = answers?.[question.id];
    const inputType = question.inputType || "choice";
    const firstEntry =
      inputType === "choice" ? choiceAnswerEntries(question, answer)[0] : undefined;
    const scoreValue = computeQuestionScore(question, answer);
    return {
      questionId: question.id,
      questionText: question.text,
      selectedOptionId: firstEntry?.optionId ?? null,
      answerText: describeQuestionAnswer(question, answer),
      scoreValue,
      scoreText: questionScoreText(question, answer, scoreValue),
    };
  });
}

/**
 * Resolve submitted option IDs against the immutable definition embedded in
 * the report snapshot. Current assessment definitions must not be passed in.
 */
export function mapSnapshotAnswers(
  snapshot: Readonly<AssessmentReportSnapshot>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): SnapshotAnswerDisplay[] {
  return mapAssessmentAnswerDisplays(snapshot.assessment, answers);
}

/**
 * Compact rows for the report UI. The caller must pass
 * `reportSnapshot.assessment`, never a freshly loaded definition.
 */
export function mapAssessmentAnswers(
  assessment: Readonly<AssessmentDefinition>,
  answers: Readonly<Record<string, unknown>> | null | undefined,
): AssessmentReportAnswerRow[] {
  return mapAssessmentAnswerDisplays(assessment, answers).map((row) => ({
    id: row.questionId,
    label: row.questionText,
    value: row.answerText,
    ...(row.scoreText ? { score: row.scoreText } : {}),
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

function classifySafeLegacyAssessmentAssetPath(
  path: string,
): "api" | "eap" | null {
  if (
    path.includes("\\") ||
    path.includes("//") ||
    !SAFE_ASSESSMENT_ASSET_PATH_PATTERN.test(path) ||
    [...path].some(
      (character) =>
        ASSESSMENT_ASSET_CONTROL_PATTERN.test(character) || /\s/u.test(character),
    )
  ) {
    return null;
  }
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const extensionIndex = filename.lastIndexOf(".");
  const extension =
    extensionIndex >= 0 ? filename.slice(extensionIndex).toLowerCase() : "";
  if (!LEGACY_ASSESSMENT_IMAGE_EXTENSIONS.has(extension)) {
    return null;
  }
  if (path.startsWith("/images/")) {
    return "eap";
  }
  return path.startsWith("/static/assessments/") ? "api" : null;
}

function classifySafeAssessmentAssetPath(
  value: string,
): "api" | "eap" | null {
  if (
    !value ||
    ASSESSMENT_ASSET_CONTROL_PATTERN.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("%") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return null;
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (ASSESSMENT_UPLOAD_PATH_PATTERN.test(decodedPath)) {
    return "api";
  }
  return classifySafeLegacyAssessmentAssetPath(decodedPath);
}

function parseAssessmentAssetReference(
  value: string | null | undefined,
):
  | {
      kind: "api" | "eap";
      absoluteUrl?: URL;
    }
  | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    value.length > MAX_ASSESSMENT_ASSET_REFERENCE_LENGTH ||
    ASSESSMENT_ASSET_CONTROL_PATTERN.test(value)
  ) {
    return undefined;
  }

  if (value.startsWith("/")) {
    const kind = classifySafeAssessmentAssetPath(value);
    return kind ? { kind } : undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    return undefined;
  }
  const kind = classifySafeAssessmentAssetPath(parsed.pathname);
  return kind ? { kind, absoluteUrl: parsed } : undefined;
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
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
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
  configuredBaseUrl: string | null | undefined,
  sameOriginBaseUrl: string | null | undefined,
): string | undefined {
  const absoluteConfiguredBase = normalizeAbsoluteBaseUrl(configuredBaseUrl);
  if (absoluteConfiguredBase) {
    return absoluteConfiguredBase;
  }

  const sameOriginBase = normalizeAbsoluteBaseUrl(sameOriginBaseUrl);
  if (!sameOriginBase) {
    return undefined;
  }

  const relativeConfiguredBase = configuredBaseUrl?.trim();
  if (!relativeConfiguredBase) {
    return sameOriginBase;
  }

  try {
    return new URL(relativeConfiguredBase, sameOriginBase).toString();
  } catch {
    return sameOriginBase;
  }
}

function collectAllowedAssetOrigins(
  configuredBaseUrl: string | null | undefined,
  sameOriginBaseUrl: string | null | undefined,
): Set<string> {
  const origins = new Set<string>();
  const configuredBase = resolveAssetBaseUrl(
    configuredBaseUrl,
    sameOriginBaseUrl,
  );
  const sameOriginBase = normalizeAbsoluteBaseUrl(sameOriginBaseUrl);
  for (const base of [configuredBase, sameOriginBase]) {
    if (!base) {
      continue;
    }
    try {
      origins.add(new URL(base).origin);
    } catch {
      // Ignore invalid environment values and fail closed below.
    }
  }
  return origins;
}

/**
 * Resolve an assessment image without touching browser globals.
 *
 * Callers can pass `process.env.NEXT_PUBLIC_EAP_BASE_URL` and, in a client
 * component, an optional same-origin base. Controlled relative paths remain
 * relative without a base. Historical absolute URLs are accepted only when
 * their origin exactly matches the configured base for that asset family.
 */
export function resolveAssessmentAssetUrl(
  value: string | null | undefined,
  optionsOrEapBaseUrl: AssessmentAssetUrlOptions | string | null = {},
): string {
  const asset = parseAssessmentAssetReference(value);
  if (!asset || !value) {
    return "";
  }

  const options =
    typeof optionsOrEapBaseUrl === "string" || optionsOrEapBaseUrl === null
      ? { eapBaseUrl: optionsOrEapBaseUrl }
      : optionsOrEapBaseUrl;
  const configuredBaseUrl =
    asset.kind === "api" ? options.apiBaseUrl : options.eapBaseUrl;
  if (asset.absoluteUrl) {
    const allowedOrigins = collectAllowedAssetOrigins(
      configuredBaseUrl,
      options.sameOriginBaseUrl,
    );
    return allowedOrigins.has(asset.absoluteUrl.origin)
      ? asset.absoluteUrl.toString()
      : "";
  }

  const baseUrl = resolveAssetBaseUrl(
    configuredBaseUrl,
    options.sameOriginBaseUrl,
  );
  if (!baseUrl) {
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}
