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

const GENERIC_SCORING_PRESETS = {
  sum: "generic-sum-v1",
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

const FIXED_SCORING_TYPES = new Set<AssessmentScoringType>([
  "aas",
  "psqi",
  "pbi",
  "cbcl",
  "dark-light",
]);

type GenericScoringType = keyof typeof GENERIC_SCORING_PRESETS;

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
  next.scoringType = type;
  next.scoringPreset = GENERIC_SCORING_PRESETS[type];

  if (definition.scoringType === type) {
    return next;
  }

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

  if (definition.scoringPreset !== ALL_SCORING_PRESETS[definition.scoringType]) {
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
      if (typeof result.image !== "string" || typeof result.shareText !== "string") {
        issues.push({
          path,
          message: "匹配结果图片和分享文案必须是字符串",
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
  });

  return issues;
}
