import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessmentEditor.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const editor = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function completeRequiredFields(definition) {
  return {
    ...definition,
    id: "editor-test",
    title: "编辑器测试量表",
    cover: "/static/assessments/editor-test.jpg",
  };
}

test("creates defaults for all generic scoring types", () => {
  const sum = editor.createDefaultAssessmentDefinition("sum");
  assert.equal(sum.scoringPreset, "generic-sum-v1");
  assert.equal(sum.scoreRanges.length, 1);
  assert.equal(sum.dimensions, undefined);

  const dimension = editor.createDefaultAssessmentDefinition("dimension");
  assert.equal(dimension.scoringPreset, "generic-dimension-v1");
  assert.deepEqual(dimension.dimensions[0].questionIds, ["q1"]);
  assert.equal(dimension.scoreRanges, undefined);

  const match = editor.createDefaultAssessmentDefinition("match");
  assert.equal(match.scoringPreset, "generic-match-v1");
  assert.equal(match.matchResults.length, 2);
  assert.deepEqual(match.questions[0].options[0].matchTags, {
    "result-1": 1,
  });
});

test("switches generic scoring types and removes incompatible fields", () => {
  const sum = editor.createDefaultAssessmentDefinition("sum");
  sum.reportProfiles = [
    {
      id: "legacy",
      title: "旧报告",
      description: "旧内容",
      suggestions: [],
    },
  ];

  const dimension = editor.changeAssessmentScoringType(sum, "dimension");
  assert.equal(dimension.scoringPreset, "generic-dimension-v1");
  assert.equal(dimension.scoreRanges, undefined);
  assert.equal(dimension.reportProfiles, undefined);
  assert.equal(dimension.dimensions.length, 1);

  const match = editor.changeAssessmentScoringType(dimension, "match");
  assert.equal(match.dimensions, undefined);
  assert.equal(match.matchResults.length, 2);
  assert.deepEqual(match.questions[0].options[1].matchTags, {
    "result-2": 1,
  });

  const switchedBack = editor.changeAssessmentScoringType(match, "sum");
  assert.equal(switchedBack.matchResults, undefined);
  assert.equal(switchedBack.questions[0].options[0].matchTags, undefined);
  assert.equal(switchedBack.scoreRanges.length, 1);
});

test("does not allow fixed scoring structures to be converted", () => {
  const fixed = {
    ...editor.createDefaultAssessmentDefinition("sum"),
    scoringType: "psqi",
    scoringPreset: "psqi-v1",
  };

  assert.equal(editor.isFixedScoringType("psqi"), true);
  assert.equal(editor.isFixedScoringType("sum"), false);
  assert.throws(
    () => editor.changeAssessmentScoringType(fixed, "sum"),
    /固定计分量表不能切换/,
  );
  assert.throws(
    () => editor.createDefaultAssessmentDefinition("aas"),
    /仅支持求和、维度和匹配/,
  );
});

test("creates deterministic protocol-safe IDs", () => {
  assert.equal(editor.createStableId("Question", []), "question");
  assert.equal(
    editor.createStableId("Question", ["question", "question-2"]),
    "question-3",
  );
  assert.equal(editor.createStableId("中文", ["item"]), "item-2");
});

test("parses and formats match tags with stable ordering", () => {
  assert.deepEqual(editor.parseMatchTags("social: 1，quiet=2"), {
    social: 1,
    quiet: 2,
  });
  assert.equal(
    editor.formatMatchTags({ social: 1, quiet: 2 }),
    "quiet: 2, social: 1",
  );
  assert.throws(() => editor.parseMatchTags("quiet"), /结果ID: 权重/);
  assert.throws(
    () => editor.parseMatchTags("quiet: 1, quiet: 2"),
    /重复/,
  );
});

test("parses and formats one suggestion per line", () => {
  assert.deepEqual(editor.parseLines(" 保持作息\n\n适量运动 "), [
    "保持作息",
    "适量运动",
  ]);
  assert.equal(editor.formatLines(["保持作息", "适量运动"]), "保持作息\n适量运动");
});

test("validates a complete default definition", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  assert.deepEqual(editor.validateAssessmentDefinition(definition), []);
});

test("detects global duplicate option IDs and overlapping ranges", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.questions.push({
    id: "q2",
    text: "题目 2",
    required: true,
    options: [
      { id: "q1-a", text: "重复选项", value: 0 },
      { id: "q2-b", text: "选项 2", value: 1 },
    ],
  });
  definition.scoreRanges = [
    {
      min: 0,
      max: 2,
      level: "低",
      description: "低分",
      suggestions: [],
    },
    {
      min: 2,
      max: 3,
      level: "高",
      description: "高分",
      suggestions: [],
    },
  ];

  const messages = editor
    .validateAssessmentDefinition(definition)
    .map((issue) => issue.message);
  assert.ok(messages.some((message) => message.includes("选项 ID 必须全局唯一")));
  assert.ok(messages.includes("分数区间不能重叠"));
});

test("detects invalid dimension and match references", () => {
  const dimension = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("dimension"),
  );
  dimension.dimensions[0].questionIds = ["missing"];
  assert.ok(
    editor
      .validateAssessmentDefinition(dimension)
      .some((issue) => issue.message.includes("不存在的题目")),
  );

  const match = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("match"),
  );
  match.questions[0].options[0].matchTags = { missing: 1 };
  assert.ok(
    editor
      .validateAssessmentDefinition(match)
      .some((issue) => issue.message.includes("没有对应的报告结果")),
  );
});

test("requires every generic match option to carry a result weight", () => {
  const match = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("match"),
  );
  match.questions[0].options[0].matchTags = {};

  assert.ok(
    editor
      .validateAssessmentDefinition(match)
      .some((issue) => issue.message.includes("至少需要一个结果权重")),
  );
});
