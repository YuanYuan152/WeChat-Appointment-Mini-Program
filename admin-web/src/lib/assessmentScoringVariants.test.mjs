import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// 与 assessmentEditorExtras.test.mjs 相同：把 TS 源码转译成 data URL 模块后直接测试纯函数。
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

const range = (min, max, level) => ({
  min,
  max,
  level,
  visitorDescription: `${level}说明`,
  analystDescription: `${level}分析`,
  suggestions: [],
});

/** 维度量表：情绪（q1+q2）、精力（q3）；人口学题：性别（单选）、职业（多选）、备注（填空）。 */
function baseDefinition() {
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
  return {
    schemaVersion: 1,
    id: "variant-test",
    version: 1,
    status: "draft",
    category: "professional",
    visibility: "public",
    title: "计分方案测试",
    subtitle: "",
    description: "",
    instructions: "请按真实情况作答。",
    cover: "/static/assessments/variant-test.jpg",
    duration: 3,
    sortOrder: 0,
    demographicQuestions: [
      {
        id: "gender",
        text: "性别？",
        inputType: "single",
        required: true,
        options: [
          { id: "gender-male", text: "男", value: "male" },
          { id: "gender-female", text: "女", value: "female" },
        ],
      },
      {
        id: "job",
        text: "职业",
        inputType: "multiple",
        required: false,
        options: [
          { id: "job-teacher", text: "教师", value: "teacher" },
          { id: "job-doctor", text: "医生", value: "doctor" },
        ],
      },
      { id: "note", text: "备注", inputType: "text", required: false },
    ],
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
    riskDimension: {
      title: "风险",
      intro: "",
      levels: {
        high: {
          rules: [
            { id: "dimension-1", type: "dimension", dimensionId: "emotion", levels: ["需关注"] },
          ],
        },
        watch: { rules: [{ id: "option-1", type: "options", match: "any", optionIds: ["q3-c"] }] },
      },
    },
    reportIntro: "以下是你的结果。",
    disclaimer: "仅供参考。",
  };
}

function issues(definition, severity = "error") {
  return editor
    .validateAssessmentDefinition(definition)
    .filter((issue) => issue.severity === severity)
    .map((issue) => `${issue.path}：${issue.message}`);
}

/** 新增一个“女”方案并选好条件。 */
function withFemaleVariant(definition = baseDefinition()) {
  const created = editor.createScoringVariant(definition);
  const next = editor.updateScoringVariant(created.definition, created.variantId, {
    title: "女",
    conditions: [{ questionId: "gender", optionIds: ["gender-female"] }],
  });
  return { definition: next, variantId: created.variantId };
}

test("variant support needs a choice demographic question", () => {
  const definition = baseDefinition();
  assert.equal(editor.hasScoringVariantSupport(definition), true);
  assert.deepEqual(
    editor.getChoiceDemographicQuestions(definition).map((question) => question.id),
    ["gender", "job"],
  );
  definition.demographicQuestions = definition.demographicQuestions.slice(2);
  assert.equal(editor.hasScoringVariantSupport(definition), false);
});

test("a new variant copies the default scoring and risk for editing", () => {
  const definition = baseDefinition();
  const { definition: next, variantId } = editor.createScoringVariant(definition);
  const [variant] = next.scoringVariants;
  assert.equal(variantId, variant.id);
  assert.equal(variant.title, "方案 1");
  assert.deepEqual(variant.conditions, [{ questionId: "gender", optionIds: [] }]);
  assert.deepEqual(variant.scoring.dimensions, definition.dimensions);
  assert.notEqual(variant.scoring.dimensions, definition.dimensions);
  assert.deepEqual(variant.riskDimension, definition.riskDimension);
  assert.deepEqual(issues(next), [
    "scoringVariants[0].conditions[0].optionIds：计分方案「方案 1」：请为「性别？」至少选择一个选项",
  ]);

  const { definition: named } = withFemaleVariant();
  assert.deepEqual(issues(named), []);
  assert.equal(
    editor.describeScoringVariantConditions(named, named.scoringVariants[0]),
    "性别：女",
  );
  assert.equal(
    editor.suggestScoringVariantTitle(named, [
      { questionId: "gender", optionIds: ["gender-female"] },
      { questionId: "job", optionIds: ["job-teacher", "job-doctor"] },
    ]),
    "女 · 教师、医生",
  );
});

test("variant scoring is validated like the default and prefixed with its name", () => {
  const { definition, variantId } = withFemaleVariant();
  const view = editor.getScoringVariantView(definition, definition.scoringVariants[0]);
  const changedView = structuredClone(view);
  changedView.dimensions[0].scoreRanges = [range(0, 2, "平稳")];
  const next = editor.applyScoringVariantView(definition, variantId, view, changedView);
  assert.deepEqual(next.dimensions, definition.dimensions, "默认方案不受影响");
  assert.ok(
    issues(next).includes(
      "scoringVariants[0].dimensions[0].scoreRanges：计分方案「女」：维度“情绪”未覆盖可达分值：3、4",
    ),
    issues(next).join("\n"),
  );
  // 方案风险引用了方案里已不存在的区间
  assert.ok(
    issues(next).some((message) =>
      message.startsWith("scoringVariants[0].riskDimension.levels.high.rules[0]"),
    ),
    issues(next).join("\n"),
  );
});

test("conditions must use choice demographics and stay distinct", () => {
  const { definition, variantId } = withFemaleVariant();
  const duplicated = editor.createScoringVariant(definition);
  const twice = editor.updateScoringVariant(duplicated.definition, duplicated.variantId, {
    title: "女二",
    conditions: [{ questionId: "gender", optionIds: ["gender-female"] }],
  });
  assert.ok(
    issues(twice).includes(
      "scoringVariants[1].conditions：计分方案「女二」与计分方案「女」的适用条件完全相同，本方案不会被使用",
    ),
  );

  const textCondition = editor.updateScoringVariant(definition, variantId, {
    conditions: [{ questionId: "note", optionIds: [] }],
  });
  assert.deepEqual(issues(textCondition), [
    "scoringVariants[0].conditions[0].questionId：计分方案「女」的适用条件只能使用单选或多选人口学题",
  ]);

  const empty = editor.updateScoringVariant(definition, variantId, { conditions: [] });
  assert.deepEqual(issues(empty), ["scoringVariants[0].conditions：计分方案「女」至少需要一个适用条件"]);

  const inheritAll = editor.setScoringVariantPartOwned(
    editor.setScoringVariantPartOwned(definition, variantId, "scoring", false),
    variantId,
    "risk",
    false,
  );
  assert.deepEqual(issues(inheritAll, "warning"), [
    "scoringVariants[0]：计分方案「女」的计分和风险都沿用默认方案，与默认方案没有区别",
  ]);
});

test("owned parts are written back; cleared risk stays owned", () => {
  const { definition, variantId } = withFemaleVariant();
  const view = editor.getScoringVariantView(definition, definition.scoringVariants[0]);
  const cleared = { ...view };
  delete cleared.riskDimension;
  const next = editor.applyScoringVariantView(definition, variantId, view, cleared);
  assert.deepEqual(next.scoringVariants[0].riskDimension, editor.createDefaultRiskDimension());
  assert.deepEqual(next.riskDimension, definition.riskDimension);

  // 沿用默认计分：视图用默认维度，写回时不产生方案计分
  const inherit = editor.setScoringVariantPartOwned(definition, variantId, "scoring", false);
  const inheritView = editor.getScoringVariantView(inherit, inherit.scoringVariants[0]);
  assert.equal(inheritView.dimensions, inherit.dimensions);
  assert.equal(inheritView.scoringVariants, undefined);
  const edited = editor.applyScoringVariantView(inherit, variantId, inheritView, {
    ...inheritView,
    dimensions: [],
  });
  assert.equal(edited.scoringVariants[0].scoring, undefined);

  // 方案维度改名时，方案自己的风险规则跟着改
  const renamedView = structuredClone(view);
  renamedView.dimensions[0].id = "mood";
  const renamed = editor.applyScoringVariantView(definition, variantId, view, renamedView);
  assert.equal(
    renamed.scoringVariants[0].riskDimension.levels.high.rules[0].dimensionId,
    "mood",
  );
  assert.equal(renamed.riskDimension.levels.high.rules[0].dimensionId, "emotion");
});

test("question renames and removals reach the variants", () => {
  const { definition } = withFemaleVariant();
  // 和题目页一样：改题目 ID、改选项 ID，再交给编辑器同步
  const renamed = structuredClone(definition);
  renamed.questions[2].id = "q3x";
  renamed.questions[2].options[2].id = "q3x-c";
  const synced = editor.syncScoringVariantReferences(definition, renamed);
  const variant = synced.scoringVariants[0];
  assert.deepEqual(variant.scoring.dimensions[1].questionIds, ["q3x"]);
  assert.deepEqual(variant.riskDimension.levels.watch.rules[0].optionIds, ["q3x-c"]);

  const removed = structuredClone(definition);
  removed.questions = removed.questions.filter((question) => question.id !== "q2");
  const afterRemoval = editor.syncScoringVariantReferences(definition, removed).scoringVariants[0];
  assert.deepEqual(afterRemoval.scoring.dimensions[0].questionIds, ["q1"]);

  const optionRemoved = structuredClone(definition);
  optionRemoved.questions[2].options = optionRemoved.questions[2].options.slice(0, 2);
  const afterOptionRemoval = editor.syncScoringVariantReferences(definition, optionRemoved)
    .scoringVariants[0];
  assert.deepEqual(afterOptionRemoval.riskDimension.levels.watch.rules[0].optionIds, []);

  // 改成多选后不能反向计分
  const reversed = structuredClone(definition);
  reversed.scoringVariants[0].scoring.dimensions[0].reverseQuestionIds = ["q1"];
  const multiple = structuredClone(reversed);
  multiple.questions[0].multiple = true;
  const afterMultiple = editor.syncScoringVariantReferences(reversed, multiple).scoringVariants[0];
  assert.deepEqual(afterMultiple.scoring.dimensions[0].reverseQuestionIds, []);
});

test("demographic edits keep variant conditions in sync", () => {
  const { definition } = withFemaleVariant();
  const renamed = structuredClone(definition);
  renamed.demographicQuestions[0].id = "sex";
  renamed.demographicQuestions[0].options[1].id = "sex-f";
  assert.deepEqual(editor.syncScoringVariantReferences(definition, renamed).scoringVariants[0].conditions, [
    { questionId: "sex", optionIds: ["sex-f"] },
  ]);

  const optionRemoved = structuredClone(definition);
  optionRemoved.demographicQuestions[0].options = optionRemoved.demographicQuestions[0].options.slice(0, 1);
  const afterOptionRemoval = editor.syncScoringVariantReferences(definition, optionRemoved);
  assert.deepEqual(afterOptionRemoval.scoringVariants[0].conditions, [
    { questionId: "gender", optionIds: [] },
  ]);

  const questionRemoved = structuredClone(definition);
  questionRemoved.demographicQuestions = questionRemoved.demographicQuestions.slice(1);
  const afterRemoval = editor.syncScoringVariantReferences(definition, questionRemoved);
  assert.deepEqual(afterRemoval.scoringVariants[0].conditions, []);
  assert.ok(issues(afterRemoval).includes("scoringVariants[0].conditions：计分方案「女」至少需要一个适用条件"));

  const becameText = structuredClone(definition);
  becameText.demographicQuestions[0].inputType = "text";
  delete becameText.demographicQuestions[0].options;
  assert.deepEqual(
    editor.syncScoringVariantReferences(definition, becameText).scoringVariants[0].conditions,
    [],
  );
});

test("switching the scoring type resets variant scoring", () => {
  const { definition } = withFemaleVariant();
  const switched = editor.changeAssessmentScoringType(definition, "sum");
  const synced = editor.syncScoringVariantReferences(definition, switched);
  const [variant] = synced.scoringVariants;
  assert.equal(variant.scoring, undefined);
  assert.deepEqual(variant.riskDimension.levels.high.rules, []);
  assert.deepEqual(variant.riskDimension.levels.watch.rules.map((rule) => rule.type), ["options"]);
});

test("default dimension renames reach variants that only own their risk", () => {
  const { definition, variantId } = withFemaleVariant();
  const riskOnly = editor.setScoringVariantPartOwned(definition, variantId, "scoring", false);
  const renamed = structuredClone(riskOnly);
  renamed.dimensions[0].id = "mood";
  const synced = editor.syncScoringVariantReferences(riskOnly, renamed);
  assert.equal(synced.scoringVariants[0].riskDimension.levels.high.rules[0].dimensionId, "mood");
});

test("variants can be reordered and removed", () => {
  const { definition } = withFemaleVariant();
  const second = editor.createScoringVariant(definition);
  const ids = second.definition.scoringVariants.map((variant) => variant.id);
  const moved = editor.moveScoringVariant(second.definition, ids[1], -1);
  assert.deepEqual(moved.scoringVariants.map((variant) => variant.id), [ids[1], ids[0]]);
  assert.equal(editor.moveScoringVariant(moved, ids[1], -1), moved);
  const removed = editor.removeScoringVariant(editor.removeScoringVariant(moved, ids[0]), ids[1]);
  assert.equal(removed.scoringVariants, undefined);
});

test("fixed scoring variants may only own risk rules", () => {
  const definition = baseDefinition();
  definition.scoringType = "psqi";
  const created = editor.createScoringVariant(definition);
  assert.equal(created.definition.scoringVariants[0].scoring, undefined);
  const owned = editor.setScoringVariantPartOwned(created.definition, created.variantId, "scoring", true);
  assert.ok(
    issues(owned).some((message) =>
      message.includes("固定计分量表的计分规则固定，方案只能单独设置风险规则"),
    ),
  );
});
