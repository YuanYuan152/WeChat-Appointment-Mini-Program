import type {
  AssessmentDefinition,
  AssessmentQuestion,
  AssessmentScoreRange,
  AssessmentScoringPreset,
  AssessmentScoringType,
  AssessmentValidationIssue,
} from "@/types/assessment";

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
      options: [
        { id: "q1-a", text: "选项 1", value: 0 },
        { id: "q1-b", text: "选项 2", value: 1 },
      ],
    },
  ];
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
    const values = question.options
      .map((option) => option.value)
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
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
      description: "请填写该分数区间对应的报告内容。",
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
    title: "",
    subtitle: "",
    description: "",
    instructions: "",
    features: "",
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
    definition.questions = questions.map((question) => ({
      ...question,
      options: question.options.map((option, index) => ({
        ...option,
        matchTags: { [`result-${(index % 2) + 1}`]: 1 },
      })),
    }));
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
    options: question.options.map((option) => {
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
    next.questions = next.questions.map((question) => ({
      ...question,
      options: question.options.map((option, index) => ({
        ...option,
        matchTags: { [`result-${(index % 2) + 1}`]: 1 },
      })),
    }));
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
  minimum: number;
  maximum: number;
  reachableCount: number;
  uncoveredScores: number[];
  validationError?: string;
}

class ReachabilityLimitError extends Error {}

function questionScoreValues(
  question: AssessmentQuestion,
  reverse: boolean,
): number[] | undefined {
  if (!Array.isArray(question.options)) {
    return undefined;
  }
  const values = question.options.map((option) => option.value);
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return undefined;
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
  aggregate: "sum" | "average",
  label: string,
  roundFinalScore = false,
): number[] | undefined {
  if (questionIds.length === 0) {
    return undefined;
  }
  const questions = new Map(
    definition.questions.map((question) => [question.id, question]),
  );
  const reverseIds = new Set(reverseQuestionIds);
  let scores = new Set([0]);

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
        nextScores.add(current + value);
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
          Number.isFinite(range.min) &&
          Number.isFinite(range.max) &&
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
        const reachableScores = enumerateReachableScores(
          definition,
          dimension.questionIds,
          Array.isArray(dimension.reverseQuestionIds)
            ? dimension.reverseQuestionIds
            : [],
          dimension.aggregate,
          `维度“${dimension.title || dimension.id || index + 1}”`,
          true,
        );
        return reachableScores
          ? [
              buildCoverageSummary(
                `dimensions[${index}].scoreRanges`,
                `维度“${dimension.title || dimension.id || index + 1}”`,
                reachableScores,
                dimension.scoreRanges,
              ),
            ]
          : [];
      });
    }
  } catch (error) {
    if (error instanceof ReachabilityLimitError) {
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
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      issues.push({
        path: itemPath,
        message: "分数区间上下限必须是数字",
        severity: "error",
      });
    } else if (range.min > range.max) {
      issues.push({
        path: itemPath,
        message: "分数区间下限不能大于上限",
        severity: "error",
      });
    } else {
      ordered.push({ min: range.min, max: range.max, path: itemPath });
    }
    if (!range.level?.trim()) {
      issues.push({
        path: `${itemPath}.level`,
        message: "请填写结果等级",
        severity: "error",
      });
    }
    if (!range.description?.trim()) {
      issues.push({
        path: `${itemPath}.description`,
        message: "请填写结果说明",
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

    if (!Array.isArray(question.options) || question.options.length < 2) {
      issues.push({
        path: `${questionPath}.options`,
        message: "每道题至少需要两个选项",
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
        if (!["sum", "average"].includes(dimension.aggregate)) {
          issues.push({
            path: `${path}.aggregate`,
            message: "维度汇总方式不合法",
            severity: "error",
          });
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
