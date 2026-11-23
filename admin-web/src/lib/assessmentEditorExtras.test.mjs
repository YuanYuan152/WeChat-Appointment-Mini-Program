import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// 与 assessmentEditor.test.mjs 相同：把 TS 源码转译成 data URL 模块后直接测试纯函数。
const sourceUrl = new URL("./assessmentEditor.ts", import.meta.url);
const formulaSourceUrl = new URL("./assessmentFormula.ts", import.meta.url);
const formulaSource = await readFile(formulaSourceUrl, "utf8");
const { outputText: formulaOutputText } = ts.transpileModule(formulaSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: formulaSourceUrl.pathname,
});
const formulaModuleUrl =
  `data:text/javascript;base64,${Buffer.from(formulaOutputText).toString("base64")}`;
const source = (await readFile(sourceUrl, "utf8")).replace(
  'from "@/lib/assessmentFormula"',
  `from "${formulaModuleUrl}"`,
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: sourceUrl.pathname,
});
const editor = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function dimensionDefinition() {
  const questions = ["q1", "q2", "q3"].map((id) => ({
    id,
    text: `题目 ${id}`,
    required: true,
    inputType: "choice",
    options: [
      { id: `${id}-a`, text: "从不", value: 0 },
      { id: `${id}-b`, text: "有时", value: 1 },
      { id: `${id}-c`, text: "经常", value: 2 },
    ],
  }));
  const range = (min, max, level) => ({
    min,
    max,
    level,
    visitorDescription: `${level}说明`,
    analystDescription: `${level}分析`,
    suggestions: [],
  });
  return {
    schemaVersion: 1,
    id: "extras-test",
    version: 1,
    status: "draft",
    category: "professional",
    visibility: "public",
    title: "总分与风险测试",
    subtitle: "",
    description: "",
    instructions: "请按真实情况作答。",
    cover: "/static/assessments/extras-test.jpg",
    duration: 3,
    sortOrder: 0,
    demographicQuestions: [],
    scoringType: "dimension",
    scoringPreset: "generic-dimension-v1",
    questions,
    dimensions: [
      {
        id: "emotion",
        title: "情绪",
        questionIds: ["q1", "q2"],
        reverseQuestionIds: [],
        calculationMode: "simple",
        aggregate: "sum",
        scoreRanges: [range(0, 2, "平稳"), range(3, 4, "需关注")],
      },
      {
        id: "energy",
        title: "精力",
        questionIds: ["q3"],
        reverseQuestionIds: [],
        calculationMode: "simple",
        aggregate: "sum",
        scoreRanges: [range(0, 2, "尚可")],
      },
    ],
    reportIntro: "以下是你的结果。",
    disclaimer: "仅供参考。",
  };
}

function withRisk(definition, levels, extra = {}) {
  definition.riskDimension = { title: "风险", intro: "", levels, ...extra };
  return definition;
}

function optionRule(id, optionIds, extra = {}) {
  return { id, type: "options", match: "any", optionIds, ...extra };
}

function scoreRule(id, extra = {}) {
  return {
    ...editor.createRiskScoreRule([]),
    id,
    questionIds: ["q1", "q2"],
    min: 3,
    max: null,
    ...extra,
  };
}

function dimensionRule(id, dimensionId, levels) {
  return { id, type: "dimension", dimensionId, levels };
}

function issues(definition, severity = "error") {
  return editor
    .validateAssessmentDefinition(definition)
    .filter((issue) => issue.severity === severity)
    .map((issue) => `${issue.path}：${issue.message}`);
}

function errorMessages(definition) {
  return issues(definition, "error");
}

test("default total score covers every reachable score", () => {
  const definition = dimensionDefinition();
  definition.totalScore = editor.createDefaultTotalScore(definition);
  assert.deepEqual(definition.totalScore.questionIds, ["q1", "q2", "q3"]);
  assert.equal(definition.totalScore.scoreRanges[0].min, 0);
  assert.equal(definition.totalScore.scoreRanges[0].max, 6);
  assert.deepEqual(errorMessages(definition), []);

  const summaries = editor.getAssessmentScoreCoverageSummaries(definition);
  const totalSummary = summaries.find((item) => item.path === "totalScore.scoreRanges");
  assert.equal(totalSummary.reachableCount, 7);
  assert.deepEqual(totalSummary.uncoveredScores, []);

  definition.totalScore.scoreRanges[0].max = 5;
  assert.ok(
    errorMessages(definition).some((message) =>
      message.startsWith("totalScore.scoreRanges：总分“总分”未覆盖可达分值：6"),
    ),
  );
});

test("scoring type change drops total score and dimension risk rules only", () => {
  const definition = withRisk(dimensionDefinition(), {
    high: { rules: [optionRule("option-1", ["q1-c"])] },
    watch: { rules: [dimensionRule("dimension-1", "emotion", ["需关注"])] },
  });
  definition.totalScore = editor.createDefaultTotalScore(definition);

  const switched = editor.changeAssessmentScoringType(definition, "sum");
  assert.equal(switched.totalScore, undefined);
  assert.deepEqual(switched.riskDimension.levels.high.rules, [optionRule("option-1", ["q1-c"])]);
  assert.deepEqual(switched.riskDimension.levels.watch.rules, [], "原维度区间被重建，引用一并移除");
  assert.deepEqual(errorMessages(switched), []);

  const broken = { ...switched, totalScore: definition.totalScore };
  assert.ok(errorMessages(broken).includes("totalScore：总分仅适用于维度计分量表"));
});

test("every risk level is optional", () => {
  const definition = dimensionDefinition();
  definition.riskDimension = editor.createDefaultRiskDimension();
  assert.deepEqual(definition.riskDimension, { title: "风险", intro: "", levels: {} });
  assert.equal(editor.isRiskDimensionActive(definition.riskDimension), false);
  assert.deepEqual(errorMessages(definition), []);
  // 没有规则时名称也可以留空
  definition.riskDimension.title = "";
  assert.deepEqual(errorMessages(definition), []);

  withRisk(definition, { high: { rules: [optionRule("option-1", ["q3-c"])] } }, { title: " " });
  assert.equal(editor.isRiskDimensionActive(definition.riskDimension), true);
  assert.deepEqual(errorMessages(definition), ["riskDimension.title：请填写风险名称"]);
  definition.riskDimension.title = "风险";
  assert.deepEqual(errorMessages(definition), []);

  withRisk(definition, { ok: { rules: [], fallback: true } });
  assert.equal(editor.isRiskDimensionActive(definition.riskDimension), true);
  assert.deepEqual(errorMessages(definition), []);
  withRisk(definition, { high: { rules: [], fallback: true }, critical: { rules: [] } });
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.critical：未知的风险等级：critical",
    "riskDimension.levels.high.fallback：高风险不能设置为未命中规则时的默认等级",
  ]);
});

test("option rules support any / multiple matching", () => {
  const definition = withRisk(dimensionDefinition(), {
    high: { rules: [editor.createRiskOptionRule([], "any")] },
  });
  assert.equal(definition.riskDimension.levels.high.rules[0].id, "option-1");
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.high.rules[0].optionIds：高风险第 1 条规则请至少选择一个触发选项",
  ]);

  const rule = definition.riskDimension.levels.high.rules[0];
  rule.optionIds = ["q3-c"];
  assert.deepEqual(errorMessages(definition), []);
  rule.optionIds = ["missing"];
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.high.rules[0].optionIds：高风险第 1 条规则的触发选项不存在：missing",
  ]);

  rule.match = "multiple";
  rule.optionIds = ["q1-c"];
  assert.ok(
    errorMessages(definition).includes(
      "riskDimension.levels.high.rules[0].optionIds：高风险第 1 条规则为多项同时被选，请至少选择 2 个选项",
    ),
  );
  rule.optionIds = ["q1-b", "q1-c"];
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.high.rules[0].optionIds：高风险第 1 条规则要求同时命中 2 项，但同一道题只能选中一个选项，所选选项最多同时命中 1 项",
  ]);
  rule.optionIds = ["q1-b", "q1-c", "q2-c", "q3-c"];
  rule.minCount = 3;
  assert.deepEqual(errorMessages(definition), []);
  rule.minCount = 5;
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.high.rules[0].minCount：高风险第 1 条规则要求同时命中的选项数不能超过已选选项数",
  ]);
  rule.minCount = 1;
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.high.rules[0].minCount：高风险第 1 条规则要求同时命中的选项数必须是不小于 2 的整数",
  ]);
});

test("dimension rules reference existing dimension ranges or the total", () => {
  const definition = withRisk(dimensionDefinition(), {
    watch: { rules: [editor.createRiskDimensionRule([], "emotion")] },
  });
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.watch.rules[0].levels：一般关注第 1 条规则请至少选择一个区间",
  ]);
  const rule = definition.riskDimension.levels.watch.rules[0];
  rule.levels = ["需关注"];
  assert.deepEqual(errorMessages(definition), []);
  rule.levels = ["不存在"];
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.watch.rules[0].levels：一般关注第 1 条规则引用的区间已不存在：不存在",
  ]);
  rule.dimensionId = "missing";
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.watch.rules[0].dimensionId：一般关注第 1 条规则引用的维度不存在：missing",
  ]);
  rule.dimensionId = editor.RISK_TOTAL_SOURCE_ID;
  rule.levels = ["0-2"];
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.watch.rules[0].dimensionId：一般关注第 1 条规则引用的总分不存在",
  ]);
  definition.totalScore = editor.createDefaultTotalScore(definition);
  rule.levels = [definition.totalScore.scoreRanges[0].level];
  assert.deepEqual(errorMessages(definition), []);
});

test("score rules need a bound and warn when no reachable score can match", () => {
  const definition = withRisk(dimensionDefinition(), {
    mid: { rules: [editor.createRiskScoreRule([])] },
  });
  const rule = definition.riskDimension.levels.mid.rules[0];
  assert.equal(rule.id, "score-1");
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.mid.rules[0].questionIds：中风险第 1 条规则至少选择一道参与计算的题目",
    "riskDimension.levels.mid.rules[0]：中风险第 1 条规则请填写最低分或最高分（另一端可不限）",
  ]);
  rule.questionIds = ["q1", "q2"];
  rule.min = 3;
  assert.deepEqual(errorMessages(definition), []);
  assert.deepEqual(editor.getRiskScoreRuleReach(definition, rule), {
    minimum: 0,
    maximum: 4,
    reachableCount: 5,
    matchedCount: 2,
  });

  rule.min = 9;
  assert.deepEqual(errorMessages(definition), []);
  assert.deepEqual(issues(definition, "warning"), [
    "riskDimension.levels.mid.rules[0]：中风险第 1 条规则的分数区间不包含任何可达分值（可达 0–4），这条规则不会命中",
  ]);
  rule.max = 1;
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.mid.rules[0]：中风险第 1 条规则的最低分不能大于最高分",
  ]);
});

test("rule ids stay unique across levels", () => {
  const definition = withRisk(dimensionDefinition(), {
    high: { rules: [optionRule("same", ["q1-c"])] },
    mid: { rules: [optionRule("same", ["q2-c"])] },
  });
  assert.deepEqual(errorMessages(definition), [
    "riskDimension.levels.mid.rules[0].id：风险规则 ID 重复：same",
  ]);
  const ids = editor.listRiskRules(definition.riskDimension).map(({ rule }) => rule.id);
  assert.equal(editor.createRiskOptionRule(["option-1", ...ids], "any").id, "option-2");
});

test("legacy risk dimension is upgraded when loading the editor", () => {
  const definition = dimensionDefinition();
  definition.riskDimension = {
    title: "风险",
    intro: "旧口径",
    scoring: {
      questionIds: ["q1", "q2"],
      reverseQuestionIds: [],
      calculationMode: "simple",
      aggregate: "sum",
      scoreRanges: [
        { min: 0, max: 2, level: "低风险", severity: "ok", analystDescription: "", suggestions: [] },
        {
          min: 3,
          max: 4,
          level: "中风险",
          severity: "mid",
          analystDescription: "情绪分偏高",
          suggestions: ["一周内回访"],
        },
      ],
    },
    triggers: [
      {
        id: "trigger-1",
        level: "高风险",
        severity: "high",
        optionIds: ["q3-c"],
        analystDescription: "需要立即联系",
        suggestions: ["当天电话联系"],
      },
    ],
  };
  const normalized = editor.normalizeAssessmentDefinition(definition);
  assert.ok(definition.riskDimension.scoring, "不修改入参");
  const risk = normalized.riskDimension;
  assert.deepEqual(Object.keys(risk.levels), ["high", "mid", "ok"]);
  assert.deepEqual(risk.levels.high, {
    rules: [optionRule("trigger-1", ["q3-c"])],
    analystDescription: "需要立即联系",
    suggestions: ["当天电话联系"],
  });
  assert.deepEqual(risk.levels.mid.rules, [
    {
      id: "rule-2",
      type: "score",
      title: "风险计分",
      questionIds: ["q1", "q2"],
      reverseQuestionIds: [],
      calculationMode: "simple",
      aggregate: "sum",
      min: 3,
      max: 4,
    },
  ]);
  assert.equal(risk.levels.ok.rules[0].id, "rule-1");
  assert.equal(risk.levels.ok.fallback, undefined);
  assert.deepEqual(errorMessages(normalized), []);

  // 旧版只配置触发规则：未触发判为无风险，升级后用兜底保持口径
  const triggerOnly = editor.upgradeLegacyRiskDimension({
    title: "风险",
    triggers: definition.riskDimension.triggers,
  });
  assert.deepEqual(triggerOnly.levels.ok, { rules: [], fallback: true });
});

test("dimension sources follow the scoring type and composed sync", () => {
  const definition = dimensionDefinition();
  assert.deepEqual(
    editor.getRiskDimensionSources(definition).map((item) => [item.id, item.ranges.map((range) => range.level)]),
    [
      ["emotion", ["平稳", "需关注"]],
      ["energy", ["尚可"]],
    ],
  );
  definition.totalScore = editor.createDefaultTotalScore(definition);
  assert.deepEqual(
    editor.getRiskDimensionSources(definition).map((item) => item.id),
    ["emotion", "energy", "__total__"],
  );
  const sum = editor.changeAssessmentScoringType(dimensionDefinition(), "sum");
  assert.deepEqual(editor.getRiskDimensionSources(sum).map((item) => [item.id, item.title]), [
    ["__total__", "总分"],
  ]);
  const match = editor.changeAssessmentScoringType(dimensionDefinition(), "match");
  assert.deepEqual(editor.getRiskDimensionSources(match), []);
  assert.deepEqual(
    editor.getRiskDimensionSources(definition).map(editor.formatRiskDimensionSource),
    ["情绪（emotion）", "精力（energy）", "总分"],
  );
});

test("composed dimension sources are labelled with their parent scale", () => {
  const definition = dimensionDefinition();
  definition.questions = definition.questions.map((question) => ({
    ...question,
    sourceAssessmentId: question.id === "q3" ? "parent-b" : "parent-a",
    sourceAssessmentTitle: question.id === "q3" ? "母量表 B" : "母量表 A",
    sourceQuestionId: question.id,
  }));
  definition.composedFrom = [
    { id: "parent-a", title: "母量表 A" },
    { id: "parent-b", title: "母量表 B" },
  ];
  const report = (sourceId, sourceTitle, questionIds, scoreRanges) => ({
    sourceId,
    sourceTitle,
    scoringType: "sum",
    scoringPreset: "generic-sum-v2",
    questionIds,
    dimensions: [
      {
        id: "total",
        title: "总分",
        questionIds,
        reverseQuestionIds: [],
        calculationMode: "simple",
        aggregate: "sum",
        scoreRanges,
      },
    ],
  });
  definition.sourceReports = [
    report("parent-a", "母量表 A", ["q1", "q2"], definition.dimensions[0].scoreRanges),
    report("parent-b", "母量表 B", ["q3"], definition.dimensions[1].scoreRanges),
  ];
  const sources = editor.getRiskDimensionSources(definition);
  // 两份母量表的维度都叫 total：同步时第二个追加序号，展示名带上母量表名称
  assert.deepEqual(
    sources.map((source) => [source.id, editor.formatRiskDimensionSource(source)]),
    [
      ["total", "总分 · 母量表 A"],
      ["total-2", "总分 · 母量表 B"],
    ],
  );
});

test("question and option edits keep total / risk references in sync", () => {
  const definition = withRisk(dimensionDefinition(), {
    high: {
      rules: [
        optionRule("option-1", ["q2-c", "q3-c"]),
        optionRule("option-2", ["q1-c", "q2-c", "q3-c"], { match: "multiple", minCount: 3 }),
      ],
    },
    mid: {
      rules: [
        scoreRule("score-1", {
          questionIds: ["q1", "q2", "q3"],
          calculationMode: "formula",
          formula: "q1 + q2 + q3",
          reverseQuestionIds: ["q2"],
        }),
      ],
    },
    watch: { rules: [dimensionRule("dimension-1", "emotion", ["需关注"])] },
  });
  definition.totalScore = editor.createDefaultTotalScore(definition);
  const known = definition.questions.map((question) => question.id);

  const renamed = editor.renameQuestionInExtras(definition, "q2", "q2x", known);
  assert.deepEqual(renamed.totalScore.questionIds, ["q1", "q2x", "q3"]);
  const renamedScore = renamed.riskDimension.levels.mid.rules[0];
  assert.equal(renamedScore.formula, "q1 + q2x + q3");
  assert.deepEqual(renamedScore.reverseQuestionIds, ["q2x"]);
  assert.equal(
    renamed.riskDimension.levels.watch.rules[0],
    definition.riskDimension.levels.watch.rules[0],
    "不相关的规则保持原对象",
  );

  const removed = editor.removeQuestionsFromExtras(definition, ["q2"], known, definition.questions);
  assert.deepEqual(removed.totalScore.questionIds, ["q1", "q3"]);
  const removedScore = removed.riskDimension.levels.mid.rules[0];
  assert.deepEqual(removedScore.questionIds, ["q1", "q3"]);
  assert.deepEqual(removedScore.reverseQuestionIds, []);
  assert.equal(removedScore.formula.replace(/\s+/g, ""), "q1+q3");
  assert.deepEqual(removed.riskDimension.levels.high.rules[0].optionIds, ["q3-c"]);
  // 删除后只剩 2 个选项，要求 3 项同时命中已不可能：收紧为全部同时被选
  assert.deepEqual(removed.riskDimension.levels.high.rules[1], {
    id: "option-2",
    type: "options",
    match: "multiple",
    optionIds: ["q1-c", "q3-c"],
  });

  const optionRenamed = editor.renameOptionInRiskRules(definition, "q3-c", "q3-often");
  assert.deepEqual(optionRenamed.riskDimension.levels.high.rules[0].optionIds, ["q2-c", "q3-often"]);
  const optionRemoved = editor.removeOptionsFromRiskRules(definition, ["q2-c"]);
  assert.deepEqual(optionRemoved.riskDimension.levels.high.rules[0].optionIds, ["q3-c"]);
  assert.equal(editor.removeOptionsFromRiskRules(definition, ["q1-a"]), definition, "无引用时原样返回");
  assert.deepEqual(
    definition.riskDimension.levels.high.rules[0].optionIds,
    ["q2-c", "q3-c"],
    "不修改入参",
  );
});

test("renaming dimensions or range levels updates dimension rules", () => {
  const definition = withRisk(dimensionDefinition(), {
    watch: { rules: [dimensionRule("dimension-1", "emotion", ["需关注"])] },
  });
  const rule = (value) => value.riskDimension.levels.watch.rules[0];

  // 区间改名：规则跟着改
  const renamedLevel = structuredClone(definition);
  renamedLevel.dimensions[0].scoreRanges[1].level = "需要关注";
  const synced = editor.syncRiskDimensionReferences(definition, renamedLevel);
  assert.deepEqual(rule(synced).levels, ["需要关注"]);
  assert.deepEqual(errorMessages(synced), []);

  // 调整分数边界不影响按名称的引用
  const rebounded = structuredClone(definition);
  rebounded.dimensions[0].scoreRanges[0].max = 1;
  rebounded.dimensions[0].scoreRanges[1].min = 2;
  assert.equal(editor.syncRiskDimensionReferences(definition, rebounded), rebounded);

  // 维度 ID 改名：规则跟着改
  const renamedId = structuredClone(definition);
  renamedId.dimensions[0].id = "mood";
  assert.equal(rule(editor.syncRiskDimensionReferences(definition, renamedId)).dimensionId, "mood");

  // 调整维度顺序不是改名，不能误改引用
  const reordered = structuredClone(definition);
  reordered.dimensions.reverse();
  assert.equal(editor.syncRiskDimensionReferences(definition, reordered), reordered);
  const swapped = structuredClone(definition);
  swapped.dimensions[0].scoreRanges.reverse();
  assert.equal(rule(editor.syncRiskDimensionReferences(definition, swapped)).levels[0], "需关注");

  // 删除区间后引用失效，交给校验提示
  const shrunk = structuredClone(definition);
  shrunk.dimensions[0].scoreRanges = shrunk.dimensions[0].scoreRanges.slice(0, 1);
  shrunk.dimensions[0].scoreRanges[0].max = 4;
  const kept = editor.syncRiskDimensionReferences(definition, shrunk);
  assert.deepEqual(rule(kept).levels, ["需关注"]);
  assert.ok(
    errorMessages(kept).includes(
      "riskDimension.levels.watch.rules[0].levels：一般关注第 1 条规则引用的区间已不存在：需关注",
    ),
  );
});

test("composed scale synced to a single sum result drops the total score", () => {
  const definition = dimensionDefinition();
  definition.questions = definition.questions.map((question) => ({
    ...question,
    sourceAssessmentId: "parent-a",
    sourceAssessmentTitle: "母量表 A",
    sourceQuestionId: question.id,
  }));
  definition.composedFrom = [{ id: "parent-a", title: "母量表 A" }];
  definition.totalScore = editor.createDefaultTotalScore(definition);
  definition.riskDimension = editor.createDefaultRiskDimension();
  definition.sourceReports = [
    {
      sourceId: "parent-a",
      sourceTitle: "母量表 A",
      scoringType: "sum",
      scoringPreset: "generic-sum-v2",
      questionIds: ["q1", "q2", "q3"],
      dimensions: [
        {
          id: "parent-a-total",
          title: "总分",
          questionIds: ["q1", "q2", "q3"],
          reverseQuestionIds: [],
          calculationMode: "simple",
          aggregate: "sum",
          scoreRanges: definition.totalScore.scoreRanges,
        },
      ],
    },
  ];
  const synced = editor.syncComposedSourceReports(definition);
  assert.equal(synced.scoringType, "sum");
  assert.equal(synced.totalScore, undefined);
  assert.ok(synced.riskDimension);
  // 组合量表按发布时同步后的结构提供可引用区间：只剩一个覆盖全部题目的结果时就是总分
  assert.deepEqual(editor.getRiskDimensionSources(definition).map((item) => item.id), ["__total__"]);

  const removed = editor.removeComposedQuestions(definition, ["q1"], "clear-explanations");
  assert.deepEqual(removed.totalScore.questionIds, ["q2", "q3"]);
});
