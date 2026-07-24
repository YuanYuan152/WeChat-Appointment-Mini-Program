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
