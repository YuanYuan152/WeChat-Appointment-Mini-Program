import type {
  AssessmentDefinition,
  AssessmentDemographicQuestion,
  AssessmentDimension,
  AssessmentOptionFollowUp,
  AssessmentQuestion,
  AssessmentQuestionInputType,
  AssessmentScoreMode,
  AssessmentScoreRange,
  AssessmentScoringPreset,
  AssessmentScoringType,
  AssessmentSourceReport,
  AssessmentValidationIssue,
} from "@/types/assessment";
import {
  compileDimensionFormula,
  removeFormulaQuestionId,
  replaceFormulaQuestionId,
} from "@/lib/assessmentFormula";

export function getQuestionInputType(
  question: Pick<AssessmentQuestion, "inputType">,
): AssessmentQuestionInputType {
  return question.inputType || "choice";
}

const STABLE_ID_PATTERN = /^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$/;
const ASSESSMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_REACHABLE_SCORE_STATES = 100_000;
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

const GENERIC_SCORING_PRESETS = {
  sum: "generic-sum-v2",
  dimension: "generic-dimension-v1",
  match: "generic-match-v1",
} as const satisfies Record<
  Extract<AssessmentScoringType, "sum" | "dimension" | "match">,
  AssessmentScoringPreset
>;

const ALL_SCORING_PRESETS: Record<
  AssessmentScoringType,
  AssessmentScoringPreset
> = {
  ...GENERIC_SCORING_PRESETS,
  aas: "aas-v1",
  psqi: "psqi-v1",
  pbi: "pbi-v1",
  cbcl: "cbcl-v1",
  "dark-light": "dark-light-v1",
};

const ALLOWED_SCORING_PRESETS: Record<
  AssessmentScoringType,
  ReadonlySet<AssessmentScoringPreset>
> = {
  sum: new Set(["generic-sum-v1", "generic-sum-v2"]),
  dimension: new Set(["generic-dimension-v1"]),
  match: new Set(["generic-match-v1"]),
  aas: new Set(["aas-v1"]),
  psqi: new Set(["psqi-v1"]),
  pbi: new Set(["pbi-v1"]),
  cbcl: new Set(["cbcl-v1"]),
  "dark-light": new Set(["dark-light-v1"]),
};

const FIXED_SCORING_TYPES = new Set<AssessmentScoringType>([
  "aas",
  "psqi",
  "pbi",
  "cbcl",
  "dark-light",
]);

type GenericScoringType = keyof typeof GENERIC_SCORING_PRESETS;

function isSafeLegacyAssessmentAssetPath(path: string): boolean {
  if (
    path.includes("\\") ||
    path.includes("//") ||
    !SAFE_ASSESSMENT_ASSET_PATH_PATTERN.test(path) ||
    [...path].some(
      (character) =>
        ASSESSMENT_ASSET_CONTROL_PATTERN.test(character) || /\s/u.test(character),
    )
  ) {
    return false;
  }
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return false;
  }
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const extensionIndex = filename.lastIndexOf(".");
  const extension =
    extensionIndex >= 0 ? filename.slice(extensionIndex).toLowerCase() : "";
  if (!LEGACY_ASSESSMENT_IMAGE_EXTENSIONS.has(extension)) {
    return false;
  }
  return path.startsWith("/images/") || path.startsWith("/static/assessments/");
}

export function isSafeAssessmentAssetReference(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value ||
    value !== value.trim() ||
    value.length > MAX_ASSESSMENT_ASSET_REFERENCE_LENGTH ||
    ASSESSMENT_ASSET_CONTROL_PATTERN.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("%") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return false;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(value);
  } catch {
    return false;
  }
  return (
    ASSESSMENT_UPLOAD_PATH_PATTERN.test(decodedPath) ||
    isSafeLegacyAssessmentAssetPath(decodedPath)
  );
}

export function getAssessmentAssetReferenceError(
  value: unknown,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): string | null {
  if (typeof value !== "string") {
    return "图片地址必须是字符串";
  }
  if (allowEmpty && value === "") {
    return null;
  }
  if (!value) {
    return "图片地址不能为空";
  }
  if (!isSafeAssessmentAssetReference(value)) {
    return (
      "仅支持 /images/、/static/assessments/ 或 " +
      "/static/assessment-assets/ 下的受控图片，且不能包含查询参数或路径穿越"
    );
  }
  return null;
}

function cloneDefinition(
  definition: AssessmentDefinition,
): AssessmentDefinition {
  return structuredClone(definition);
}

/** 兼容已规范区间，以及旧 JSON 仅有 description、字段残缺的脏数据。 */
type ScoreRangeInput = Partial<AssessmentScoreRange> & {
  description?: unknown;
};

function rangeText(
  range: ScoreRangeInput,
  key: "visitorDescription" | "analystDescription",
): string {
  const current = range[key];
  if (typeof current === "string" && current.trim()) {
    return current;
  }
  return typeof range.description === "string" ? range.description : "";
}

function finiteScoreBound(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeScoreRange(range: ScoreRangeInput): AssessmentScoreRange {
  const visitorDescription = rangeText(range, "visitorDescription");
  const analystDescription = rangeText(range, "analystDescription");
  return {
    min: finiteScoreBound(range.min),
    max: finiteScoreBound(range.max),
    level: typeof range.level === "string" ? range.level : "",
    visitorDescription,
    analystDescription,
    suggestions: Array.isArray(range.suggestions)
      ? range.suggestions.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeScoreRanges(
  ranges: readonly ScoreRangeInput[],
): AssessmentScoreRange[];
function normalizeScoreRanges(
  ranges?: readonly ScoreRangeInput[] | null,
): AssessmentScoreRange[] | undefined;
function normalizeScoreRanges(
  ranges?: readonly ScoreRangeInput[] | null,
): AssessmentScoreRange[] | undefined {
  if (!Array.isArray(ranges)) {
    return undefined;
  }
  return ranges.map((range) => normalizeScoreRange(range));
}

export function normalizeAssessmentDefinition(
  definition: AssessmentDefinition,
): AssessmentDefinition {
  const next = cloneDefinition(definition);
  if (Array.isArray(next.scoreRanges)) {
    next.scoreRanges = normalizeScoreRanges(next.scoreRanges);
  }
  if (Array.isArray(next.dimensions)) {
    next.dimensions = next.dimensions.map((dimension) => ({
      ...dimension,
      scoreRanges: normalizeScoreRanges(dimension.scoreRanges) || dimension.scoreRanges,
    }));
  }
  return next;
}

function isGenericScoringType(
  type: AssessmentScoringType,
): type is GenericScoringType {
  return type in GENERIC_SCORING_PRESETS;
}

function createDefaultQuestions(): AssessmentQuestion[] {
  return [
    {
      id: "q1",
      text: "题目 1",
      required: true,
      inputType: "choice",
      options: [
        { id: "q1-a", text: "选项 1", value: 0 },
        { id: "q1-b", text: "选项 2", value: 1 },
      ],
    },
  ];
}

function followUpScoreValues(followUp: AssessmentOptionFollowUp): number[] {
  const completed = Number.isFinite(followUp.completedScore)
    ? Number(followUp.completedScore)
    : 0;
  const empty = Number.isFinite(followUp.emptyScore)
    ? Number(followUp.emptyScore)
    : 0;
  if (followUp.scoreMode === "value") {
    const min = followUp.validation?.min;
    const max = followUp.validation?.max;
    if (!Number.isFinite(min) || !Number.isFinite(max) || max! < min!) {
      return [];
    }
    if (max! - min! > 500) {
      return [];
    }
    if (Number.isInteger(min) && Number.isInteger(max)) {
      const values: number[] = [];
      for (let value = min!; value <= max!; value += 1) {
        values.push(value);
      }
      return values;
    }
    return [min!, max!];
  }
  return followUp.required ? [completed] : [completed, empty];
}

function getQuestionScoreBounds(
  questions: AssessmentQuestion[],
  questionIds?: Iterable<string>,
): [number, number] {
  const selectedIds = questionIds ? new Set(questionIds) : null;
  let minimum = 0;
  let maximum = 0;

  for (const question of questions) {
    if (selectedIds && !selectedIds.has(question.id)) {
      continue;
    }
    const values = questionScoreValues(question, false);
    if (!values || values.length === 0) {
      continue;
    }
    minimum += Math.min(...values);
    maximum += Math.max(...values);
  }

  return [minimum, maximum];
}

function createDefaultScoreRanges(
  questions: AssessmentQuestion[],
  questionIds?: Iterable<string>,
): AssessmentScoreRange[] {
  const [minimum, maximum] = getQuestionScoreBounds(questions, questionIds);
  return [
    {
      min: minimum,
      max: maximum,
      level: "待配置结果",
      visitorDescription: "请填写面向来访的结果说明。",
      analystDescription: "请填写面向分析方的结果说明。",
      suggestions: [],
    },
  ];
}

/**
 * Create a deterministic, protocol-safe ID.
 *
 * The same prefix and occupied-ID set always produce the same value. This is
 * useful for repeatable add-question/add-option actions and avoids timestamp
 * IDs leaking into published JSON.
 */
export function createStableId(
  prefix: string,
  existingIds: Iterable<string>,
): string {
  const normalized =
    prefix
      .normalize("NFKD")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  const used = new Set(existingIds);

  if (!used.has(normalized)) {
    return normalized;
  }

  let suffix = 2;
  while (used.has(`${normalized}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalized}-${suffix}`;
}

export function isFixedScoringType(type: AssessmentScoringType): boolean {
  return FIXED_SCORING_TYPES.has(type);
}

export function createDefaultAssessmentDefinition(
  type: AssessmentScoringType = "sum",
): AssessmentDefinition {
  if (!isGenericScoringType(type)) {
    throw new Error("新建量表仅支持求和、维度和匹配三种通用计分方式");
  }

  const questions = createDefaultQuestions();
  const definition: AssessmentDefinition = {
    schemaVersion: 1,
    id: "",
    version: 1,
    status: "draft",
    category: type === "match" ? "fun" : "professional",
    visibility: "public",
    title: "",
    subtitle: "",
    description: "",
    instructions: "",
    cover: "",
    duration: 5,
    sortOrder: 0,
    demographicQuestions: [],
    scoringType: type,
    scoringPreset: GENERIC_SCORING_PRESETS[type],
    questions,
    reportIntro: "",
    disclaimer: "本测评结果仅供参考，不能替代专业诊断。",
  };

  if (type === "sum") {
    definition.reverseQuestionIds = [];
    definition.scoreRanges = createDefaultScoreRanges(questions);
  } else if (type === "dimension") {
    definition.dimensions = [
      {
        id: "dimension-1",
        title: "维度 1",
        intro: "",
        questionIds: questions.map((question) => question.id),
        reverseQuestionIds: [],
        calculationMode: "simple",
        aggregate: "sum",
        scoreRanges: createDefaultScoreRanges(questions),
      },
    ];
  } else {
    definition.matchResults = [
      {
        id: "result-1",
        title: "结果 1",
        description: "请填写结果说明。",
        suggestions: [],
        image: "",
        shareText: "",
      },
      {
        id: "result-2",
        title: "结果 2",
        description: "请填写结果说明。",
        suggestions: [],
        image: "",
        shareText: "",
      },
    ];
    definition.questions = questions.map((question) => {
      const options =
        getQuestionInputType(question) === "choice" && question.options.length >= 2
          ? question.options
          : [
              { id: `${question.id}-a`, text: "选项 1", value: 0 },
              { id: `${question.id}-b`, text: "选项 2", value: 1 },
            ];
      return {
        ...question,
        inputType: "choice",
        scoreMode: undefined,
        completedScore: undefined,
        emptyScore: undefined,
        validation: undefined,
        options: options.map((option, index) => ({
          ...option,
          matchTags: { [`result-${(index % 2) + 1}`]: 1 },
        })),
      };
    });
  }

  return definition;
}

/**
 * Switch a generic definition to another generic scoring model.
 *
 * Fixed built-in assessments intentionally cannot be converted: their
 * question IDs and score values are part of the server-side scoring contract.
 */
export function changeAssessmentScoringType(
  definition: AssessmentDefinition,
  type: AssessmentScoringType,
): AssessmentDefinition {
  if (isFixedScoringType(definition.scoringType)) {
    throw new Error("固定计分量表不能切换计分方式");
  }
  if (!isGenericScoringType(type)) {
    throw new Error("新建量表仅支持求和、维度和匹配三种通用计分方式");
  }

  const next = cloneDefinition(definition);
  if (definition.scoringType === type) {
    return next;
  }
  next.scoringType = type;
  next.scoringPreset = GENERIC_SCORING_PRESETS[type];

  delete next.scoreRanges;
  delete next.dimensions;
  delete next.matchResults;
  delete next.reportProfiles;
  delete next.reverseQuestionIds;
  next.questions = next.questions.map((question) => ({
    ...question,
    options: (question.options || []).map((option) => {
      const withoutMatchTags = { ...option };
      delete withoutMatchTags.matchTags;
      return withoutMatchTags;
    }),
  }));

  if (type === "sum") {
    next.reverseQuestionIds = [];
    next.scoreRanges = createDefaultScoreRanges(next.questions);
  } else if (type === "dimension") {
    const questionIds = next.questions.map((question) => question.id);
    next.dimensions = [
      {
        id: "dimension-1",
        title: "维度 1",
        intro: "",
        questionIds,
        reverseQuestionIds: [],
        calculationMode: "simple",
        aggregate: "sum",
        scoreRanges: createDefaultScoreRanges(next.questions, questionIds),
      },
    ];
  } else {
    next.matchResults = [
      {
        id: "result-1",
        title: "结果 1",
        description: "请填写结果说明。",
        suggestions: [],
        image: "",
        shareText: "",
      },
      {
        id: "result-2",
        title: "结果 2",
        description: "请填写结果说明。",
        suggestions: [],
        image: "",
        shareText: "",
      },
    ];
    next.questions = next.questions.map((question) => {
      const options =
        getQuestionInputType(question) === "choice" &&
        (question.options || []).length >= 2
          ? question.options
          : [
              { id: `${question.id}-a`, text: "选项 1", value: 0 },
              { id: `${question.id}-b`, text: "选项 2", value: 1 },
            ];
      return {
        ...question,
        inputType: "choice",
        scoreMode: undefined,
        completedScore: undefined,
        emptyScore: undefined,
        validation: undefined,
        options: options.map((option, index) => ({
          ...option,
          matchTags: { [`result-${(index % 2) + 1}`]: 1 },
        })),
      };
    });
  }

  return next;
}

export function formatMatchTags(
  tags: Record<string, number> | undefined,
): string {
  if (!tags) {
    return "";
  }
  return Object.entries(tags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, weight]) => `${id}: ${weight}`)
    .join(", ");
}

export function parseMatchTags(text: string): Record<string, number> {
  const value = text.trim();
  if (!value) {
    return {};
  }

  const tags: Record<string, number> = {};
  const entries = value
    .split(/[,，;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const match = entry.match(/^(.+?)\s*[:：=]\s*(.+)$/);
    if (!match) {
      throw new Error(`匹配标签“${entry}”应使用“结果ID: 权重”格式`);
    }
    const id = match[1].trim();
    const weight = Number(match[2].trim());
    if (!STABLE_ID_PATTERN.test(id)) {
      throw new Error(`匹配标签包含非法结果 ID：${id}`);
    }
    if (!Number.isFinite(weight)) {
      throw new Error(`匹配标签“${id}”的权重必须是数字`);
    }
    if (Object.hasOwn(tags, id)) {
      throw new Error(`匹配标签“${id}”重复`);
    }
    tags[id] = weight;
  }

  return tags;
}

export function formatLines(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface AssessmentScoreCoverageSummary {
  path: string;
  label: string;
  parentDimensionId?: string;
  minimum: number;
  maximum: number;
  reachableCount: number;
  uncoveredScores: number[];
  validationError?: string;
}

export function getDimensionParentId(dimensionId: string): string | undefined {
  const parts = dimensionId.trim().split(".");
  return parts.length === 2 && parts.every(Boolean) ? parts[0] : undefined;
}

class ReachabilityLimitError extends Error {}

function questionScoreValues(
  question: AssessmentQuestion,
  reverse: boolean,
): number[] | undefined {
  const inputType = getQuestionInputType(question);
  if (inputType === "text" || inputType === "number") {
    const scoreMode: AssessmentScoreMode = question.scoreMode || "filled";
    const completed = Number.isFinite(question.completedScore)
      ? Number(question.completedScore)
      : 0;
    const empty = Number.isFinite(question.emptyScore)
      ? Number(question.emptyScore)
      : 0;
    if (scoreMode === "value") {
      if (inputType !== "number") {
        return undefined;
      }
      const min = question.validation?.min;
      const max = question.validation?.max;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max! < min!) {
        return undefined;
      }
      if (max! - min! > 500) {
        return undefined;
      }
      if (Number.isInteger(min) && Number.isInteger(max)) {
        const values: number[] = [];
        for (let value = min!; value <= max!; value += 1) {
          values.push(value);
        }
        if (!question.required) {
          values.push(empty);
        }
        return [...new Set(values)];
      }
      const values = [min!, max!];
      if (!question.required) {
        values.push(empty);
      }
      return [...new Set(values)];
    }
    const values = [completed];
    if (!question.required) {
      values.push(empty);
    }
    return [...new Set(values)];
  }

  if (!Array.isArray(question.options) || question.options.length === 0) {
    return undefined;
  }
  const values: number[] = [];
  for (const option of question.options) {
    if (!Number.isFinite(option.value)) {
      return undefined;
    }
    if (option.followUp) {
      const extras = followUpScoreValues(option.followUp);
      if (extras.length === 0) {
        return undefined;
      }
      for (const extra of extras) {
        values.push(option.value + extra);
      }
    } else {
      values.push(option.value);
    }
  }
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const scoreValues = reverse
    ? values.map((value) => maximum + minimum - value)
    : values;
  if (!question.required) {
    scoreValues.push(0);
  }
  return [...new Set(scoreValues)];
}

function enumerateReachableScores(
  definition: AssessmentDefinition,
  questionIds: string[],
  reverseQuestionIds: string[],
  aggregate: "sum" | "product" | "average",
  label: string,
  roundFinalScore = false,
  calculationMode: "simple" | "formula" = "simple",
  formula = "",
): number[] | undefined {
  if (questionIds.length === 0) {
    return undefined;
  }
  const questions = new Map(
    definition.questions.map((question) => [question.id, question]),
  );
  const reverseIds = new Set(reverseQuestionIds);
  const compiledFormula =
    calculationMode === "formula"
      ? compileDimensionFormula(
          formula,
          definition.questions.map((question) => question.id),
        )
      : null;

  if (compiledFormula) {
    let states: Array<Record<string, number>> = [{}];
    for (const questionId of questionIds) {
      const question = questions.get(questionId);
      if (!question) {
        return undefined;
      }
      const values = questionScoreValues(question, reverseIds.has(questionId));
      if (!values) {
        return undefined;
      }
      const nextStates: Array<Record<string, number>> = [];
      for (const state of states) {
        for (const value of values) {
          nextStates.push({ ...state, [questionId]: value });
          if (nextStates.length > MAX_REACHABLE_SCORE_STATES) {
            throw new ReachabilityLimitError(
              `${label}可达组合超过 ${MAX_REACHABLE_SCORE_STATES.toLocaleString("zh-CN")} 个，无法完成精确校验，请简化公式或选项分值`,
            );
          }
        }
      }
      states = nextStates;
    }
    return [
      ...new Set(
        states.map(
          (state) => Math.round(compiledFormula.evaluate(state) * 100) / 100,
        ),
      ),
    ].sort((left, right) => left - right);
  }

  let scores = new Set([aggregate === "product" ? 1 : 0]);

  for (const questionId of questionIds) {
    const question = questions.get(questionId);
    if (!question) {
      return undefined;
    }
    const values = questionScoreValues(question, reverseIds.has(questionId));
    if (!values) {
      return undefined;
    }
    const nextScores = new Set<number>();
    for (const current of scores) {
      for (const value of values) {
        nextScores.add(aggregate === "product" ? current * value : current + value);
        if (nextScores.size > MAX_REACHABLE_SCORE_STATES) {
          throw new ReachabilityLimitError(
            `${label}可达分值超过 ${MAX_REACHABLE_SCORE_STATES.toLocaleString("zh-CN")} 个，无法完成精确校验，请简化选项分值`,
          );
        }
      }
    }
    scores = nextScores;
  }

  if (aggregate === "average") {
    const divisor = questionIds.length;
    scores = new Set(
      [...scores].map(
        (score) => Math.round((score / divisor) * 100) / 100,
      ),
    );
  } else if (roundFinalScore) {
    scores = new Set(
      [...scores].map((score) => Math.round(score * 100) / 100),
    );
  }
  return [...scores].sort((left, right) => left - right);
}

function buildCoverageSummary(
  path: string,
  label: string,
  reachableScores: number[],
  ranges: AssessmentScoreRange[] | undefined,
): AssessmentScoreCoverageSummary {
  const uncoveredScores = reachableScores.filter(
    (score) =>
      !ranges?.some(
        (range) =>
          typeof range.min === "number" &&
          typeof range.max === "number" &&
          range.min <= score &&
          score <= range.max,
      ),
  );
  return {
    path,
    label,
    minimum: reachableScores[0] ?? 0,
    maximum: reachableScores.at(-1) ?? 0,
    reachableCount: reachableScores.length,
    uncoveredScores,
  };
}

function formatScore(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("zh-CN")
    : value.toLocaleString("zh-CN", { maximumFractionDigits: 12 });
}

export function getAssessmentScoreCoverageSummaries(
  definition: AssessmentDefinition,
): AssessmentScoreCoverageSummary[] {
  try {
    if (definition.scoringType === "sum") {
      if (!Array.isArray(definition.questions) || definition.questions.length === 0) {
        return [];
      }
      const isV2 = definition.scoringPreset === "generic-sum-v2";
      const reachableScores = enumerateReachableScores(
        definition,
        definition.questions.map((question) => question.id),
        isV2 ? definition.reverseQuestionIds ?? [] : [],
        "sum",
        "总分",
        isV2,
      );
      return reachableScores
        ? [
            buildCoverageSummary(
              "scoreRanges",
              "总分",
              reachableScores,
              definition.scoreRanges,
            ),
          ]
        : [];
    }

    if (definition.scoringType === "psqi") {
      return [
        buildCoverageSummary(
          "scoreRanges",
          "PSQI 总分",
          Array.from({ length: 19 }, (_, score) => score),
          definition.scoreRanges,
        ),
      ];
    }

    if (definition.scoringType === "dimension") {
      if (
        !Array.isArray(definition.questions) ||
        !Array.isArray(definition.dimensions)
      ) {
        return [];
      }
      return definition.dimensions.flatMap((dimension, index) => {
        if (!Array.isArray(dimension.questionIds)) {
          return [];
        }
        const parentDimensionId = getDimensionParentId(dimension.id);
        const parentDimension = parentDimensionId
          ? definition.dimensions?.find((item) => item.id === parentDimensionId)
          : undefined;
        const dimensionName = dimension.title || dimension.id || String(index + 1);
        const coverageLabel = parentDimension
          ? `维度“${parentDimension.title || parentDimension.id}” › 子维度“${dimensionName}”`
          : `维度“${dimensionName}”`;
        const reachableScores = enumerateReachableScores(
          definition,
          dimension.questionIds,
          Array.isArray(dimension.reverseQuestionIds)
            ? dimension.reverseQuestionIds
            : [],
          dimension.aggregate,
          coverageLabel,
          true,
          dimension.calculationMode ?? "simple",
          dimension.formula ?? "",
        );
        return reachableScores
          ? [
              {
                ...buildCoverageSummary(
                  `dimensions[${index}].scoreRanges`,
                  coverageLabel,
                  reachableScores,
                  dimension.scoreRanges,
                ),
                parentDimensionId,
              },
            ]
          : [];
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      return [
        {
          path: "scoring",
          label: "计分",
          minimum: 0,
          maximum: 0,
          reachableCount: 0,
          uncoveredScores: [],
          validationError: error.message,
        },
      ];
    }
    throw error;
  }
  return [];
}

function validateRanges(
  ranges: AssessmentScoreRange[] | undefined,
  path: string,
  issues: AssessmentValidationIssue[],
): void {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    issues.push({
      path,
      message: "至少需要一个分数区间",
      severity: "error",
    });
    return;
  }

  const ordered: Array<{ min: number; max: number; path: string }> = [];
  ranges.forEach((range, index) => {
    const itemPath = `${path}[${index}]`;
    const low = finiteScoreBound(range.min);
    const high = finiteScoreBound(range.max);
    if (low === null || high === null) {
      issues.push({
        path: itemPath,
        message: "请填写最低分和最高分",
        severity: "error",
      });
    } else if (low > high) {
      issues.push({
        path: itemPath,
        message: "分数区间下限不能大于上限",
        severity: "error",
      });
    } else {
      ordered.push({ min: low, max: high, path: itemPath });
    }
    if (!range.level?.trim()) {
      issues.push({
        path: `${itemPath}.level`,
        message: "请填写结果等级",
        severity: "error",
      });
    }
    if (!range.visitorDescription?.trim()) {
      issues.push({
        path: `${itemPath}.visitorDescription`,
        message: "请填写面向来访结果说明",
        severity: "error",
      });
    }
    if (!range.analystDescription?.trim()) {
      issues.push({
        path: `${itemPath}.analystDescription`,
        message: "请填写面向分析方结果说明",
        severity: "error",
      });
    }
    if (
      !Array.isArray(range.suggestions) ||
      range.suggestions.some(
        (suggestion) =>
          typeof suggestion !== "string" || !suggestion.trim(),
      )
    ) {
      issues.push({
        path: `${itemPath}.suggestions`,
        message: "建议内容不能包含空行",
        severity: "error",
      });
    }
  });

  ordered.sort((left, right) => left.min - right.min || left.max - right.max);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].min <= ordered[index - 1].max) {
      issues.push({
        path: ordered[index].path,
        message: "分数区间不能重叠",
        severity: "error",
      });
    }
  }
}

function addDuplicateIssues(
  entries: Array<{ id: string; path: string }>,
  issues: AssessmentValidationIssue[],
  message: string,
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
      issues.push({
        path: entry.path,
        message: `${message}：${entry.id}`,
        severity: "error",
      });
    }
    seen.add(entry.id);
  }
  return duplicates;
}

export function validateAssessmentDefinition(
  definition: AssessmentDefinition,
  coverageSummaries = getAssessmentScoreCoverageSummaries(definition),
): AssessmentValidationIssue[] {
  definition = normalizeAssessmentDefinition(definition);
  const issues: AssessmentValidationIssue[] = [];
  const addRequired = (path: string, label: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
      issues.push({
        path,
        message: `请填写${label}`,
        severity: "error",
      });
    }
  };

  if (definition.schemaVersion !== 1) {
    issues.push({
      path: "schemaVersion",
      message: "schemaVersion 必须为 1",
      severity: "error",
    });
  }
  addRequired("id", "量表 ID", definition.id);
  if (definition.id && !ASSESSMENT_ID_PATTERN.test(definition.id)) {
    issues.push({
      path: "id",
      message: "量表 ID 只能使用小写字母、数字和连字符",
      severity: "error",
    });
  } else if (typeof definition.id === "string" && definition.id.length > 54) {
    issues.push({
      path: "id",
      message: "量表 ID 不能超过 54 个字符",
      severity: "error",
    });
  }
  addRequired("title", "量表名称", definition.title);
  addRequired("cover", "封面地址", definition.cover);
  if (typeof definition.cover === "string" && definition.cover.trim()) {
    const coverError = getAssessmentAssetReferenceError(definition.cover);
    if (coverError) {
      issues.push({
        path: "cover",
        message: coverError,
        severity: "error",
      });
    }
  }
  addRequired("instructions", "指导语", definition.instructions);
  addRequired("reportIntro", "报告引导文案", definition.reportIntro);
  addRequired("disclaimer", "免责声明", definition.disclaimer);

  if (!Number.isInteger(definition.version) || definition.version < 1) {
    issues.push({
      path: "version",
      message: "版本号必须是大于等于 1 的整数",
      severity: "error",
    });
  }
  if (
    !Number.isInteger(definition.duration) ||
    definition.duration < 1 ||
    definition.duration > 240
  ) {
    issues.push({
      path: "duration",
      message: "预计时长必须是 1 到 240 分钟的整数",
      severity: "error",
    });
  }
  if (
    definition.sortOrder !== undefined &&
    (!Number.isInteger(definition.sortOrder) || definition.sortOrder < 0)
  ) {
    issues.push({
      path: "sortOrder",
      message: "排序值必须是非负整数",
      severity: "error",
    });
  }

  if (
    !ALLOWED_SCORING_PRESETS[definition.scoringType]?.has(
      definition.scoringPreset,
    )
  ) {
    issues.push({
      path: "scoringPreset",
      message: `计分模板应为 ${ALL_SCORING_PRESETS[definition.scoringType]}`,
      severity: "error",
    });
  }

  if (!Array.isArray(definition.questions) || definition.questions.length === 0) {
    issues.push({
      path: "questions",
      message: "至少需要一道量表题目",
      severity: "error",
    });
    return issues;
  }

  const questionIds = new Set<string>();
  const questionEntries: Array<{ id: string; path: string }> = [];
  const optionEntries: Array<{ id: string; path: string }> = [];
  definition.questions.forEach((question, questionIndex) => {
    const questionPath = `questions[${questionIndex}]`;
    addRequired(`${questionPath}.id`, "题目 ID", question.id);
    if (question.id && !STABLE_ID_PATTERN.test(question.id)) {
      issues.push({
        path: `${questionPath}.id`,
        message: "题目 ID 格式不合法",
        severity: "error",
      });
    }
    addRequired(`${questionPath}.text`, "题目内容", question.text);
    questionEntries.push({
      id: question.id,
      path: `${questionPath}.id`,
    });
    questionIds.add(question.id);

    const inputType = getQuestionInputType(question);
    if (!["choice", "text", "number"].includes(inputType)) {
      issues.push({
        path: `${questionPath}.inputType`,
        message: "题目类型不合法",
        severity: "error",
      });
    }
    const scoreMode = question.scoreMode || "filled";
    if (!["filled", "value"].includes(scoreMode)) {
      issues.push({
        path: `${questionPath}.scoreMode`,
        message: "计分方式不合法",
        severity: "error",
      });
    }
    if (inputType === "text" || inputType === "number") {
      if (scoreMode === "value" && inputType !== "number") {
        issues.push({
          path: `${questionPath}.scoreMode`,
          message: "仅数字题支持按填写数字计分",
          severity: "error",
        });
      }
      if (scoreMode === "value") {
        if (
          !Number.isFinite(question.validation?.min) ||
          !Number.isFinite(question.validation?.max)
        ) {
          issues.push({
            path: `${questionPath}.validation`,
            message: "按数字计分必须设置最小值和最大值",
            severity: "error",
          });
        } else if ((question.validation?.max ?? 0) < (question.validation?.min ?? 0)) {
          issues.push({
            path: `${questionPath}.validation`,
            message: "最大值必须大于等于最小值",
            severity: "error",
          });
        }
      }
      if (Array.isArray(question.options) && question.options.length > 0) {
        issues.push({
          path: `${questionPath}.options`,
          message: "填空/数字题不能配置选项",
          severity: "error",
        });
      }
      return;
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      issues.push({
        path: `${questionPath}.options`,
        message: "选择题至少需要两个选项",
        severity: "error",
      });
      return;
    }
    question.options.forEach((option, optionIndex) => {
      const optionPath = `${questionPath}.options[${optionIndex}]`;
      addRequired(`${optionPath}.id`, "选项 ID", option.id);
      if (option.id && !STABLE_ID_PATTERN.test(option.id)) {
        issues.push({
          path: `${optionPath}.id`,
          message: "选项 ID 格式不合法",
          severity: "error",
        });
      }
      addRequired(`${optionPath}.text`, "选项内容", option.text);
      if (!Number.isFinite(option.value)) {
        issues.push({
          path: `${optionPath}.value`,
          message: "选项分值必须是数字",
          severity: "error",
        });
      }
      optionEntries.push({ id: option.id, path: `${optionPath}.id` });
      const followUp = option.followUp;
      if (!followUp) {
        return;
      }
      if (!["text", "number"].includes(followUp.inputType)) {
        issues.push({
          path: `${optionPath}.followUp.inputType`,
          message: "追问类型不合法",
          severity: "error",
        });
      }
      if (!["filled", "value"].includes(followUp.scoreMode)) {
        issues.push({
          path: `${optionPath}.followUp.scoreMode`,
          message: "追问计分方式不合法",
          severity: "error",
        });
      }
      if (followUp.scoreMode === "value" && followUp.inputType !== "number") {
        issues.push({
          path: `${optionPath}.followUp.scoreMode`,
          message: "仅数字追问支持按填写数字计分",
          severity: "error",
        });
      }
      if (followUp.scoreMode === "value") {
        if (
          !Number.isFinite(followUp.validation?.min) ||
          !Number.isFinite(followUp.validation?.max)
        ) {
          issues.push({
            path: `${optionPath}.followUp.validation`,
            message: "按数字计分的追问必须设置最小值和最大值",
            severity: "error",
          });
        }
      }
    });
  });
  addDuplicateIssues(questionEntries, issues, "题目 ID 重复");
  addDuplicateIssues(optionEntries, issues, "选项 ID 必须全局唯一");

  const reverseIds = definition.reverseQuestionIds ?? [];
  addDuplicateIssues(
    reverseIds.map((id, index) => ({
      id,
      path: `reverseQuestionIds[${index}]`,
    })),
    issues,
    "反向计分题目重复",
  );
  reverseIds.forEach((id, index) => {
    if (!questionIds.has(id)) {
      issues.push({
        path: `reverseQuestionIds[${index}]`,
        message: `反向计分题目不存在：${id}`,
        severity: "error",
      });
    }
  });

  const demographicQuestions = definition.demographicQuestions ?? [];
  addDuplicateIssues(
    demographicQuestions.map((question, index) => ({
      id: question.id,
      path: `demographicQuestions[${index}].id`,
    })),
    issues,
    "人口学题目 ID 重复",
  );
  demographicQuestions.forEach((question, index) => {
    const path = `demographicQuestions[${index}]`;
    addRequired(`${path}.id`, "人口学题目 ID", question.id);
    addRequired(`${path}.text`, "人口学题目内容", question.text);
    if (question.id && !STABLE_ID_PATTERN.test(question.id)) {
      issues.push({
        path: `${path}.id`,
        message: "人口学题目 ID 格式不合法",
        severity: "error",
      });
    }
    if (!["single", "multiple", "text", "number", "date"].includes(question.inputType)) {
      issues.push({
        path: `${path}.inputType`,
        message: "人口学题目输入类型不合法",
        severity: "error",
      });
    }
    if (
      (question.inputType === "single" ||
        question.inputType === "multiple") &&
      (!Array.isArray(question.options) || question.options.length === 0)
    ) {
      issues.push({
        path: `${path}.options`,
        message: "单选或多选人口学题目至少需要一个选项",
        severity: "error",
      });
    }
    const demographicOptions = question.options ?? [];
    addDuplicateIssues(
      demographicOptions.map((option, optionIndex) => ({
        id: option.id,
        path: `${path}.options[${optionIndex}].id`,
      })),
      issues,
      "人口学选项 ID 重复",
    );
    demographicOptions.forEach((option, optionIndex) => {
      const optionPath = `${path}.options[${optionIndex}]`;
      addRequired(`${optionPath}.id`, "人口学选项 ID", option.id);
      addRequired(`${optionPath}.text`, "人口学选项内容", option.text);
      if (option.id && !STABLE_ID_PATTERN.test(option.id)) {
        issues.push({
          path: `${optionPath}.id`,
          message: "人口学选项 ID 格式不合法",
          severity: "error",
        });
      }
      if (
        option.value === null ||
        !["string", "number", "boolean"].includes(typeof option.value)
      ) {
        issues.push({
          path: `${optionPath}.value`,
          message: "人口学选项值必须是字符串、数字或布尔值",
          severity: "error",
        });
      }
    });
  });

  if (
    definition.scoringType === "sum" ||
    definition.scoringType === "psqi"
  ) {
    validateRanges(definition.scoreRanges, "scoreRanges", issues);
  }

  if (definition.scoringType === "dimension") {
    if (!definition.dimensions?.length) {
      issues.push({
        path: "dimensions",
        message: "维度计分至少需要一个维度",
        severity: "error",
      });
    } else {
      addDuplicateIssues(
        definition.dimensions.map((dimension, index) => ({
          id: dimension.id,
          path: `dimensions[${index}].id`,
        })),
        issues,
        "维度 ID 重复",
      );
      const dimensionIds = new Set(
        definition.dimensions.map((dimension) => dimension.id),
      );
      definition.dimensions.forEach((dimension, index) => {
        const path = `dimensions[${index}]`;
        addRequired(`${path}.id`, "维度 ID", dimension.id);
        addRequired(`${path}.title`, "维度名称", dimension.title);
        if (dimension.id && !STABLE_ID_PATTERN.test(dimension.id)) {
          issues.push({
            path: `${path}.id`,
            message: "维度 ID 格式不合法",
            severity: "error",
          });
        }
        const idParts = dimension.id.split(".");
        if (idParts.length > 2) {
          issues.push({
            path: `${path}.id`,
            message: "维度最多支持两级，子维度 ID 格式应为“父维度ID.子维度ID”",
            severity: "error",
          });
        } else if (
          idParts.length === 2 &&
          idParts[0] &&
          !dimensionIds.has(idParts[0])
        ) {
          issues.push({
            path: `${path}.id`,
            message: `子维度缺少父维度：${idParts[0]}`,
            severity: "error",
          });
        }
        const calculationMode = dimension.calculationMode ?? "simple";
        if (!["simple", "formula"].includes(calculationMode)) {
          issues.push({
            path: `${path}.calculationMode`,
            message: "维度计算方式不合法",
            severity: "error",
          });
        }
        if (!["sum", "product", "average"].includes(dimension.aggregate)) {
          issues.push({
            path: `${path}.aggregate`,
            message: "简单计算方式不合法",
            severity: "error",
          });
        }
        if (calculationMode === "formula") {
          try {
            const compiled = compileDimensionFormula(
              dimension.formula ?? "",
              definition.questions.map((question) => question.id),
            );
            const selected = new Set(dimension.questionIds);
            const referenced = new Set(compiled.questionIds);
            if (
              selected.size !== referenced.size ||
              [...selected].some((id) => !referenced.has(id))
            ) {
              issues.push({
                path: `${path}.formula`,
                message: "公式中的题目 ID 必须与已点选题目完全一致",
                severity: "error",
              });
            }
          } catch (error) {
            issues.push({
              path: `${path}.formula`,
              message: error instanceof Error ? error.message : "公式不合法",
              severity: "error",
            });
          }
        }
        if (!dimension.questionIds.length) {
          issues.push({
            path: `${path}.questionIds`,
            message: "每个维度至少关联一道题目",
            severity: "error",
          });
        }
        addDuplicateIssues(
          dimension.questionIds.map((id, questionIndex) => ({
            id,
            path: `${path}.questionIds[${questionIndex}]`,
          })),
          issues,
          "维度关联题目重复",
        );
        dimension.questionIds.forEach((id, questionIndex) => {
          if (!questionIds.has(id)) {
            issues.push({
              path: `${path}.questionIds[${questionIndex}]`,
              message: `维度引用了不存在的题目：${id}`,
              severity: "error",
            });
          }
        });
        (dimension.reverseQuestionIds ?? []).forEach(
          (id, questionIndex) => {
            if (!dimension.questionIds.includes(id)) {
              issues.push({
                path: `${path}.reverseQuestionIds[${questionIndex}]`,
                message: `维度反向计分题目必须属于该维度：${id}`,
                severity: "error",
              });
            }
          },
        );
        validateRanges(dimension.scoreRanges, `${path}.scoreRanges`, issues);
      });
    }
  }

  if (
    definition.scoringType === "match" ||
    definition.scoringType === "aas"
  ) {
    const results = definition.matchResults ?? [];
    if (!results.length) {
      issues.push({
        path: "matchResults",
        message: "匹配计分至少需要一个报告结果",
        severity: "error",
      });
    }
    const resultIds = new Set(results.map((result) => result.id));
    const referencedResultIds = new Set<string>();
    addDuplicateIssues(
      results.map((result, index) => ({
        id: result.id,
        path: `matchResults[${index}].id`,
      })),
      issues,
      "匹配结果 ID 重复",
    );
    results.forEach((result, index) => {
      const path = `matchResults[${index}]`;
      addRequired(`${path}.id`, "匹配结果 ID", result.id);
      addRequired(`${path}.title`, "匹配结果名称", result.title);
      addRequired(`${path}.description`, "匹配结果说明", result.description);
      if (result.id && !STABLE_ID_PATTERN.test(result.id)) {
        issues.push({
          path: `${path}.id`,
          message: "匹配结果 ID 格式不合法",
          severity: "error",
        });
      }
      if (typeof result.image !== "string") {
        issues.push({
          path: `${path}.image`,
          message: "匹配结果图片必须是字符串",
          severity: "error",
        });
      } else {
        const imageError = getAssessmentAssetReferenceError(result.image, {
          allowEmpty: true,
        });
        if (imageError) {
          issues.push({
            path: `${path}.image`,
            message: imageError,
            severity: "error",
          });
        }
      }
      if (typeof result.shareText !== "string") {
        issues.push({
          path: `${path}.shareText`,
          message: "匹配结果分享文案必须是字符串",
          severity: "error",
        });
      }
      if (
        result.suggestions !== undefined &&
        (!Array.isArray(result.suggestions) ||
          result.suggestions.some(
            (suggestion) => typeof suggestion !== "string" || !suggestion.trim(),
          ))
      ) {
        issues.push({
          path: `${path}.suggestions`,
          message: "匹配结果建议格式不合法",
          severity: "error",
        });
      }
    });
    definition.questions.forEach((question, questionIndex) => {
      question.options.forEach((option, optionIndex) => {
        if (
          definition.scoringType === "match" &&
          Object.keys(option.matchTags ?? {}).length === 0
        ) {
          issues.push({
            path: `questions[${questionIndex}].options[${optionIndex}].matchTags`,
            message: "匹配型量表的每个选项至少需要一个结果权重",
            severity: "error",
          });
        }
        for (const [resultId, weight] of Object.entries(
          option.matchTags ?? {},
        )) {
          referencedResultIds.add(resultId);
          const path = `questions[${questionIndex}].options[${optionIndex}].matchTags.${resultId}`;
          if (!resultIds.has(resultId)) {
            issues.push({
              path,
              message: `匹配标签没有对应的报告结果：${resultId}`,
              severity: "error",
            });
          }
          if (!Number.isFinite(weight)) {
            issues.push({
              path,
              message: "匹配权重必须是数字",
              severity: "error",
            });
          }
        }
      });
    });
    if (definition.scoringType === "match") {
      if (!definition.questions.some((question) => question.required)) {
        issues.push({
          path: "questions",
          message: "匹配型量表至少需要一道必答题",
          severity: "error",
        });
      }
      results.forEach((result, index) => {
        if (!referencedResultIds.has(result.id)) {
          issues.push({
            path: `matchResults[${index}].id`,
            message: `匹配结果未被任何选项引用：${result.id}`,
            severity: "error",
          });
        }
      });
    }
  }

  const reportProfiles = definition.reportProfiles ?? [];
  addDuplicateIssues(
    reportProfiles.map((profile, index) => ({
      id: profile.id,
      path: `reportProfiles[${index}].id`,
    })),
    issues,
    "报告文案 ID 重复",
  );
  reportProfiles.forEach((profile, index) => {
    const path = `reportProfiles[${index}]`;
    addRequired(`${path}.id`, "报告文案 ID", profile.id);
    addRequired(`${path}.title`, "报告文案标题", profile.title);
    addRequired(`${path}.description`, "报告文案说明", profile.description);
    if (profile.id && !STABLE_ID_PATTERN.test(profile.id)) {
      issues.push({
        path: `${path}.id`,
        message: "报告文案 ID 格式不合法",
        severity: "error",
      });
    }
    if (
      !Array.isArray(profile.suggestions) ||
      profile.suggestions.some(
        (suggestion) => typeof suggestion !== "string" || !suggestion.trim(),
      )
    ) {
      issues.push({
        path: `${path}.suggestions`,
        message: "报告文案建议格式不合法",
        severity: "error",
      });
    }
    if (profile.image !== undefined) {
      const imageError = getAssessmentAssetReferenceError(profile.image, {
        allowEmpty: true,
      });
      if (imageError) {
        issues.push({
          path: `${path}.image`,
          message: imageError,
          severity: "error",
        });
      }
    }
    if (profile.shareText !== undefined && typeof profile.shareText !== "string") {
      issues.push({
        path: `${path}.shareText`,
        message: "报告文案分享文案必须是字符串",
        severity: "error",
      });
    }
  });

  coverageSummaries.forEach((summary) => {
    if (summary.validationError) {
      issues.push({
        path: summary.path,
        message: summary.validationError,
        severity: "error",
      });
      return;
    }
    if (summary.uncoveredScores.length > 0) {
      const preview = summary.uncoveredScores
        .slice(0, 8)
        .map(formatScore)
        .join("、");
      const suffix =
        summary.uncoveredScores.length > 8
          ? ` 等 ${summary.uncoveredScores.length.toLocaleString("zh-CN")} 个`
          : "";
      issues.push({
        path: summary.path,
        message: `${summary.label}未覆盖可达分值：${preview}${suffix}`,
        severity: "error",
      });
    }
  });

  return issues;
}

function allocateStableId(preferred: string, used: Set<string>) {
  const nextId = createStableId(preferred, used);
  used.add(nextId);
  return nextId;
}

function createComposedAssessmentId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `combo-${hex}`;
}

/** 删除题目后，把已有结果说明的分数区间扩到剩余题目可达范围。 */
export function fitAssessmentScoreRanges(
  definition: AssessmentDefinition,
): AssessmentDefinition {
  if (definition.scoringType === "sum") {
    const ranges = createDefaultScoreRanges(definition.questions);
    const current = definition.scoreRanges?.[0];
    return {
      ...definition,
      scoreRanges: current
        ? [{ ...current, min: ranges[0].min, max: ranges[0].max }]
        : ranges,
    };
  }
  if (definition.scoringType === "dimension" && definition.dimensions) {
    return {
      ...definition,
      dimensions: definition.dimensions.map((dimension) => {
        const ranges = createDefaultScoreRanges(
          definition.questions,
          dimension.questionIds,
        );
        const current = dimension.scoreRanges?.[0];
        return {
          ...dimension,
          scoreRanges: current
            ? [{ ...current, min: ranges[0].min, max: ranges[0].max }]
            : ranges,
        };
      }),
    };
  }
  return definition;
}

function mergeDemographicQuestions(
  sources: AssessmentDefinition[],
): AssessmentDemographicQuestion[] {
  const usedIds = new Set<string>();
  const questions: AssessmentDemographicQuestion[] = [];
  for (const source of sources) {
    for (const question of source.demographicQuestions || []) {
      questions.push({
        ...structuredClone(question),
        id: allocateStableId(question.id, usedIds),
      });
    }
  }
  return questions;
}

const DARK_TRAIT_GROUPS: Array<{
  id: string;
  title: string;
  questionIds: string[];
}> = [
  {
    id: "machiavellianism",
    title: "维度一：马基雅维利主义倾向",
    questionIds: ["d1", "d2", "d3", "d4"],
  },
  {
    id: "psychopathy",
    title: "维度二：精神病态倾向",
    questionIds: ["d5", "d6", "d7", "d8"],
  },
  {
    id: "narcissism",
    title: "维度三：自恋倾向",
    questionIds: ["d9", "d10", "d11", "d12"],
  },
];

function remapQuestionIds(ids: string[] | undefined, idMap: Map<string, string>) {
  return (ids || [])
    .map((questionId) => idMap.get(questionId))
    .filter((questionId): questionId is string => Boolean(questionId));
}

function darkTraitDimensions(idMap: Map<string, string>): AssessmentDimension[] {
  const traits = DARK_TRAIT_GROUPS.map((group) => {
    const questionIds = remapQuestionIds(group.questionIds, idMap);
    return {
      id: group.id,
      title: group.title,
      questionIds,
      reverseQuestionIds: [] as string[],
      calculationMode: "simple" as const,
      aggregate: "sum" as const,
      scoreRanges: [
        { min: 4, max: 12, level: "低", visitorDescription: "低", analystDescription: "低", suggestions: [] },
        { min: 13, max: 20, level: "中", visitorDescription: "中", analystDescription: "中", suggestions: [] },
        { min: 21, max: 28, level: "高", visitorDescription: "高", analystDescription: "高", suggestions: [] },
      ],
    };
  });
  const totalQuestionIds = traits.flatMap((dimension) => dimension.questionIds);
  return [
    ...traits,
    {
      id: "dark-total",
      title: "黑暗人格总分",
      questionIds: totalQuestionIds,
      reverseQuestionIds: [],
      calculationMode: "simple",
      aggregate: "sum",
      scoreRanges: [
        { min: 12, max: 36, level: "低", visitorDescription: "低", analystDescription: "低", suggestions: [] },
        { min: 37, max: 60, level: "中", visitorDescription: "中", analystDescription: "中", suggestions: [] },
        { min: 61, max: 84, level: "高", visitorDescription: "高", analystDescription: "高", suggestions: [] },
      ],
    },
  ];
}

/**
 * 按母量表把原来的维度和记分题目拼进组合量表。
 * 已从组合量表删掉的题目不会再出现在对应维度里。
 */
export function buildSourceReports(
  definition: AssessmentDefinition,
  parents: AssessmentDefinition[],
): AssessmentSourceReport[] {
  const sources = definition.composedFrom || [];
  return sources.map((source) => {
    const parent = parents.find((item) => item.id === source.id);
    const owned = definition.questions.filter(
      (question) => question.sourceAssessmentId === source.id,
    );
    const idMap = new Map(
      owned.map((question) => [question.sourceQuestionId || question.id, question.id]),
    );
    const questionIds = owned.map((question) => question.id);
    let dimensions: AssessmentDimension[] | undefined;
    if (parent?.dimensions?.length) {
      dimensions = parent.dimensions.map((dimension) => ({
        ...structuredClone(dimension),
        questionIds: remapQuestionIds(dimension.questionIds, idMap),
        reverseQuestionIds: remapQuestionIds(dimension.reverseQuestionIds, idMap),
        scoreRanges:
          normalizeScoreRanges(dimension.scoreRanges) ||
          createDefaultScoreRanges(definition.questions, remapQuestionIds(dimension.questionIds, idMap)),
      }));
    } else if (parent?.scoringType === "dark-light") {
      dimensions = darkTraitDimensions(idMap);
    } else if (parent?.matchResults?.length) {
      dimensions = parent.matchResults.map((result) => ({
        id: result.id,
        title: result.title,
        intro: result.description,
        questionIds,
        reverseQuestionIds: [] as string[],
        calculationMode: "simple" as const,
        aggregate: "sum" as const,
        scoreRanges: createDefaultScoreRanges(definition.questions, questionIds),
      }));
    } else {
      dimensions = [
        {
          id: `${source.id}-total`,
          title: "总分",
          questionIds,
          reverseQuestionIds: remapQuestionIds(parent?.reverseQuestionIds, idMap),
          calculationMode: "simple",
          aggregate: "sum",
          scoreRanges:
            parent?.scoreRanges && parent.scoreRanges.length > 0
              ? normalizeScoreRanges(parent.scoreRanges) || parent.scoreRanges
              : createDefaultScoreRanges(definition.questions, questionIds),
        },
      ];
    }
    return {
      sourceId: source.id,
      sourceTitle: source.title || parent?.title || source.id,
      scoringType: parent?.scoringType || "sum",
      scoringPreset: parent?.scoringPreset || "generic-sum-v2",
      questionIds,
      dimensions,
      scoreRanges: parent?.scoreRanges
        ? normalizeScoreRanges(parent.scoreRanges)
        : undefined,
      reverseQuestionIds: remapQuestionIds(parent?.reverseQuestionIds, idMap),
      matchResults: parent?.matchResults ? structuredClone(parent.matchResults) : undefined,
      reportProfiles: parent?.reportProfiles ? structuredClone(parent.reportProfiles) : undefined,
    };
  });
}

export const COMPOSED_MULTI_SOURCE_PLACEHOLDERS = {
  instructions: "请填写指导语。",
  reportIntro: "请填写报告引导文案。",
  disclaimer: "请填写免责声明。",
} as const;

/** 组合量表「合并结果」在 sourceReports 中的固定标识。 */
export const COMPOSED_MERGED_SOURCE_ID = "__merged__";
export const COMPOSED_MERGED_SOURCE_TITLE = "合并结果";

export type ComposedQuestionRemovalMode = "clear-explanations" | "clear-bounds";

function rewriteScoreRangesForRemoval(
  ranges: AssessmentScoreRange[] | undefined,
  mode: ComposedQuestionRemovalMode,
): AssessmentScoreRange[] | undefined {
  if (!ranges) {
    return ranges;
  }
  return ranges.map((range) =>
    mode === "clear-explanations"
      ? {
          ...range,
          visitorDescription: "",
          analystDescription: "",
          suggestions: [],
        }
      : {
          ...range,
          min: null,
          max: null,
        },
  );
}

function withoutRemovedQuestionLinks(
  dimension: AssessmentDimension,
  removedIds: Set<string>,
  knownQuestionIds: string[],
): AssessmentDimension {
  let formula = dimension.formula;
  if (dimension.calculationMode === "formula" && formula) {
    for (const id of removedIds) {
      formula = removeFormulaQuestionId(formula, id, knownQuestionIds);
    }
  }
  return {
    ...dimension,
    questionIds: dimension.questionIds.filter((id) => !removedIds.has(id)),
    reverseQuestionIds: dimension.reverseQuestionIds?.filter((id) => !removedIds.has(id)),
    formula,
  };
}

/**
 * 从组合量表草稿中去掉题目，并按所选方式处理平铺窗格里的报告结果。
 * 不自动改写分数区间。题目不足一道时返回 null。
 */
export function removeComposedQuestions(
  definition: AssessmentDefinition,
  removedIds: Iterable<string>,
  mode: ComposedQuestionRemovalMode,
): AssessmentDefinition | null {
  const ids = new Set(removedIds);
  const questions = definition.questions.filter((question) => !ids.has(question.id));
  if (ids.size === 0 || questions.length < 1) {
    return ids.size === 0 ? definition : null;
  }
  const knownQuestionIds = definition.questions.map((question) => question.id);
  return {
    ...definition,
    questions,
    reverseQuestionIds: definition.reverseQuestionIds?.filter((id) => !ids.has(id)),
    dimensions: definition.dimensions?.map((dimension) =>
      withoutRemovedQuestionLinks(dimension, ids, knownQuestionIds),
    ),
    sourceReports: definition.sourceReports?.map((report) => ({
      ...report,
      questionIds: report.questionIds.filter((id) => !ids.has(id)),
      reverseQuestionIds: report.reverseQuestionIds?.filter((id) => !ids.has(id)),
      scoreRanges: rewriteScoreRangesForRemoval(report.scoreRanges, mode),
      dimensions: report.dimensions?.map((dimension) => ({
        ...withoutRemovedQuestionLinks(dimension, ids, knownQuestionIds),
        scoreRanges:
          rewriteScoreRangesForRemoval(dimension.scoreRanges, mode) || dimension.scoreRanges,
      })),
    })),
  };
}

/**
 * 发布前把平铺窗格中的结果同步成真正参与计分的报告。
 * 只有一个覆盖全部题目的求和维度时保持总分计分，其余情况改为维度计分。
 */
export function syncComposedSourceReports(
  definition: AssessmentDefinition,
): AssessmentDefinition {
  const reports = definition.sourceReports;
  if (!definition.composedFrom?.length || !reports?.length) {
    return definition;
  }
  const usedIds = new Set<string>();
  const dimensions: AssessmentDimension[] = [];
  for (const report of reports) {
    const owned = definition.questions.filter(
      (question) => question.sourceAssessmentId === report.sourceId,
    );
    const idMap = new Map(
      owned.map((question) => [question.sourceQuestionId || question.id, question.id]),
    );
    for (const dimension of report.dimensions || []) {
      let formula = dimension.formula || "";
      if (dimension.calculationMode === "formula" && formula) {
        const knownIds = [...idMap.keys(), ...dimension.questionIds];
        for (const [previousId, nextId] of idMap) {
          if (previousId !== nextId) {
            formula = replaceFormulaQuestionId(formula, previousId, nextId, knownIds);
          }
        }
      }
      const preferredId = dimension.id || "dimension";
      const id = usedIds.has(preferredId)
        ? createStableId(preferredId, usedIds)
        : preferredId;
      usedIds.add(id);
      dimensions.push({
        ...structuredClone(dimension),
        id,
        formula: dimension.calculationMode === "formula" ? formula : dimension.formula,
        scoreRanges: (dimension.scoreRanges || []).map((range) => ({ ...range })),
      });
    }
  }
  if (dimensions.length === 0) {
    return definition;
  }
  const questionIds = new Set(definition.questions.map((question) => question.id));
  if (dimensions.length === 1) {
    const only = dimensions[0];
    const selected = new Set(only.questionIds);
    const coversAll =
      questionIds.size > 0 &&
      selected.size === questionIds.size &&
      [...questionIds].every((id) => selected.has(id));
    const simpleSum =
      (only.calculationMode || "simple") !== "formula" && (only.aggregate || "sum") === "sum";
    if (coversAll && simpleSum) {
      return {
        ...definition,
        scoringType: "sum",
        scoringPreset:
          definition.scoringPreset === "generic-sum-v1" ? "generic-sum-v1" : "generic-sum-v2",
        scoreRanges: only.scoreRanges,
        reverseQuestionIds: only.reverseQuestionIds || [],
        dimensions: undefined,
      };
    }
  }
  return {
    ...definition,
    scoringType: "dimension",
    scoringPreset: "generic-dimension-v1",
    dimensions,
    scoreRanges: undefined,
    reverseQuestionIds: undefined,
  };
}

/**
 * 把多份母量表的题目复制进一份新的通用计分草稿。
 * 母量表本身不会被修改。题目保留来源，便于之后按母量表批量删除。
 */
export function composeAssessmentDefinition(
  title: string,
  sources: AssessmentDefinition[],
): AssessmentDefinition {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("请填写新量表名称");
  }
  if (sources.length === 0) {
    throw new Error("请至少选择一个母量表");
  }

  const usedQuestionIds = new Set<string>();
  const usedOptionIds = new Set<string>();
  const questions: AssessmentQuestion[] = [];
  const sourceMaps: Array<{
    definition: AssessmentDefinition;
    idMap: Map<string, string>;
  }> = [];

  for (const source of sources) {
    const idMap = new Map<string, string>();
    for (const question of source.questions || []) {
      const nextId = allocateStableId(question.id, usedQuestionIds);
      idMap.set(question.id, nextId);
      const options = (question.options || []).map((option) => {
        const next = structuredClone(option);
        next.id = allocateStableId(option.id, usedOptionIds);
        delete next.matchTags;
        return next;
      });
      questions.push({
        ...structuredClone(question),
        id: nextId,
        options,
        sourceAssessmentId: source.id,
        sourceAssessmentTitle: source.title || source.id,
        sourceQuestionId: question.id,
      });
    }
    sourceMaps.push({ definition: source, idMap });
  }

  if (questions.length === 0) {
    throw new Error("所选母量表没有可复制的题目");
  }

  const scoringTypes = new Set(sources.map((source) => source.scoringType));
  const sharedType = scoringTypes.size === 1 ? sources[0].scoringType : null;
  const scoringType: AssessmentScoringType =
    sharedType === "dimension" ? "dimension" : "sum";
  const primary = sources[0];
  const singleSource = sources.length === 1;
  const cover =
    primary.cover?.trim() || sources.map((source) => source.cover?.trim()).find(Boolean);
  if (!cover) {
    throw new Error("所选母量表没有可用封面，无法组合");
  }
  const inheritedText = (value: string | undefined, fallback: string) => {
    const trimmed = value?.trim();
    return trimmed || fallback;
  };

  const definition: AssessmentDefinition = {
    schemaVersion: 1,
    id: createComposedAssessmentId(),
    version: 1,
    status: "draft",
    category: sources.some((source) => source.category === "professional")
      ? "professional"
      : "fun",
    visibility: sources.every((source) => source.visibility === "private")
      ? "private"
      : "public",
    title: trimmedTitle,
    subtitle: singleSource
      ? "由母量表组合生成"
      : primary.subtitle?.trim() || "",
    description: singleSource
      ? `题目来自母量表：${sources.map((source) => source.title || source.id).join("、")}`
      : primary.description?.trim() || "",
    instructions: singleSource
      ? inheritedText(primary.instructions, COMPOSED_MULTI_SOURCE_PLACEHOLDERS.instructions)
      : COMPOSED_MULTI_SOURCE_PLACEHOLDERS.instructions,
    cover,
    duration: Math.min(
      240,
      Math.max(
        1,
        sources.reduce((total, source) => total + (Number(source.duration) || 0), 0),
      ),
    ),
    sortOrder: 0,
    demographicQuestions: singleSource ? mergeDemographicQuestions(sources) : [],
    scoringType,
    scoringPreset:
      scoringType === "dimension" ? "generic-dimension-v1" : "generic-sum-v2",
    questions,
    reportIntro: singleSource
      ? inheritedText(primary.reportIntro, COMPOSED_MULTI_SOURCE_PLACEHOLDERS.reportIntro)
      : COMPOSED_MULTI_SOURCE_PLACEHOLDERS.reportIntro,
    disclaimer: singleSource
      ? inheritedText(primary.disclaimer, COMPOSED_MULTI_SOURCE_PLACEHOLDERS.disclaimer)
      : COMPOSED_MULTI_SOURCE_PLACEHOLDERS.disclaimer,
    composedFrom: sources.map((source) => ({
      id: source.id,
      title: source.title || source.id,
    })),
  };

  const features = singleSource
    ? sources
        .map((source) => source.features?.trim())
        .filter(Boolean)
        .join("\n\n")
    : primary.features?.trim() || "";
  if (features) {
    definition.features = features;
  }

  if (scoringType === "dimension") {
    const usedDimensionIds = new Set<string>();
    const dimensions: AssessmentDimension[] = [];
    for (const { definition: source, idMap } of sourceMaps) {
      for (const dimension of source.dimensions || []) {
        const questionIds = dimension.questionIds
          .map((questionId) => idMap.get(questionId))
          .filter((questionId): questionId is string => Boolean(questionId));
        if (questionIds.length === 0) {
          continue;
        }
        let formula = dimension.formula || "";
        const knownIds = [...idMap.keys(), ...questionIds];
        if (dimension.calculationMode === "formula" && formula) {
          for (const [previousId, nextId] of idMap) {
            if (previousId !== nextId) {
              formula = replaceFormulaQuestionId(formula, previousId, nextId, knownIds);
            }
          }
        }
        dimensions.push({
          ...structuredClone(dimension),
          id: allocateStableId(dimension.id, usedDimensionIds),
          questionIds,
          reverseQuestionIds: (dimension.reverseQuestionIds || [])
            .map((questionId) => idMap.get(questionId))
            .filter((questionId): questionId is string => Boolean(questionId)),
          formula: dimension.calculationMode === "formula" ? formula : dimension.formula,
          scoreRanges: createDefaultScoreRanges(questions, questionIds),
        });
      }
    }
    if (dimensions.length === 0) {
      throw new Error("所选维度量表没有可复制的维度题目");
    }
    definition.dimensions = dimensions;
  } else {
    const reverseQuestionIds = new Set<string>();
    for (const { definition: source, idMap } of sourceMaps) {
      for (const questionId of source.reverseQuestionIds || []) {
        const nextId = idMap.get(questionId);
        if (nextId) {
          reverseQuestionIds.add(nextId);
        }
      }
    }
    definition.reverseQuestionIds = [...reverseQuestionIds];
    definition.scoreRanges = createDefaultScoreRanges(questions);
  }

  definition.sourceReports = buildSourceReports(definition, sources);
  return definition;
}
