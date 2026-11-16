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

function errorMessages(definition) {
  return editor
    .validateAssessmentDefinition(definition)
    .filter((issue) => issue.severity === "error")
    .map((issue) => `${issue.path}：${issue.message}`);
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

test("total score is rejected outside dimension scoring and dropped on type change", () => {
  const definition = dimensionDefinition();
  definition.totalScore = editor.createDefaultTotalScore(definition);
  definition.riskDimension = editor.createDefaultRiskDimension();

  const switched = editor.changeAssessmentScoringType(definition, "sum");
  assert.equal(switched.totalScore, undefined);
  assert.ok(switched.riskDimension, "风险维度与计分方式无关，切换后保留");

  const broken = { ...switched, totalScore: definition.totalScore };
  assert.ok(errorMessages(broken).includes("totalScore：总分仅适用于维度计分量表"));
});

test("risk dimension needs options for triggers and coverage for scoring", () => {
  const definition = dimensionDefinition();
  definition.riskDimension = editor.createDefaultRiskDimension();
  assert.equal(definition.riskDimension.title, "风险");
  assert.ok(
    errorMessages(definition).includes("riskDimension.triggers[0].optionIds：请至少选择一个触发选项"),
  );

  definition.riskDimension.triggers[0].optionIds = ["q3-c"];
  assert.deepEqual(errorMessages(definition), []);

  definition.riskDimension.triggers[0].optionIds = ["missing"];
  assert.ok(
    errorMessages(definition).includes("riskDimension.triggers[0].optionIds：触发选项不存在：missing"),
  );

  definition.riskDimension = {
    title: "风险",
    scoring: editor.createDefaultRiskScoring(definition),
  };
  assert.deepEqual(errorMessages(definition), []);
  definition.riskDimension.scoring.scoreRanges = [
    { ...editor.createRiskRange(0, 3), level: "低风险", severity: "ok" },
    { ...editor.createRiskRange(5, 6), level: "高风险", severity: "high" },
  ];
  assert.ok(
    errorMessages(definition).includes(
      "riskDimension.scoring.scoreRanges：风险维度计分未覆盖可达分值：4",
    ),
  );

  definition.riskDimension = { title: "风险" };
  assert.ok(
    errorMessages(definition).includes(
      "riskDimension：风险维度至少需要配置计分判定或选项触发规则",
    ),
  );
});

test("risk dimension is allowed on sum and match scales", () => {
  const sum = editor.changeAssessmentScoringType(dimensionDefinition(), "sum");
  sum.riskDimension = {
    title: "风险",
    triggers: [{ ...editor.createRiskTrigger([]), optionIds: ["q1-c"] }],
  };
  assert.deepEqual(errorMessages(sum), []);
});

test("question and option edits keep total / risk references in sync", () => {
  const definition = dimensionDefinition();
  definition.totalScore = editor.createDefaultTotalScore(definition);
  definition.riskDimension = {
    title: "风险",
    scoring: {
      ...editor.createDefaultRiskScoring(definition),
      calculationMode: "formula",
      formula: "q1 + q2 + q3",
      reverseQuestionIds: ["q2"],
    },
    triggers: [{ ...editor.createRiskTrigger([]), optionIds: ["q2-c", "q3-c"] }],
  };
  const known = definition.questions.map((question) => question.id);

  const renamed = editor.renameQuestionInExtras(definition, "q2", "q2x", known);
  assert.deepEqual(renamed.totalScore.questionIds, ["q1", "q2x", "q3"]);
  assert.equal(renamed.riskDimension.scoring.formula, "q1 + q2x + q3");
  assert.deepEqual(renamed.riskDimension.scoring.reverseQuestionIds, ["q2x"]);

  const removed = editor.removeQuestionsFromExtras(definition, ["q2"], known, definition.questions);
  assert.deepEqual(removed.totalScore.questionIds, ["q1", "q3"]);
  assert.deepEqual(removed.riskDimension.scoring.questionIds, ["q1", "q3"]);
  assert.deepEqual(removed.riskDimension.scoring.reverseQuestionIds, []);
  assert.equal(removed.riskDimension.scoring.formula.replace(/\s+/g, ""), "q1+q3");
  assert.deepEqual(removed.riskDimension.triggers[0].optionIds, ["q3-c"]);

  const optionRenamed = editor.renameOptionInRiskTriggers(definition, "q3-c", "q3-often");
  assert.deepEqual(optionRenamed.riskDimension.triggers[0].optionIds, ["q2-c", "q3-often"]);
  const optionRemoved = editor.removeOptionsFromRiskTriggers(definition, ["q2-c"]);
  assert.deepEqual(optionRemoved.riskDimension.triggers[0].optionIds, ["q3-c"]);
  assert.deepEqual(definition.riskDimension.triggers[0].optionIds, ["q2-c", "q3-c"], "不修改入参");
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

  const removed = editor.removeComposedQuestions(definition, ["q1"], "clear-explanations");
  assert.deepEqual(removed.totalScore.questionIds, ["q2", "q3"]);
});
