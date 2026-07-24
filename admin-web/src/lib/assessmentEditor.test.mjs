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
  assert.equal(sum.scoringPreset, "generic-sum-v2");
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

test("does not implicitly upgrade a legacy sum when the type is unchanged", () => {
  const legacy = editor.createDefaultAssessmentDefinition("sum");
  legacy.scoringPreset = "generic-sum-v1";

  const unchanged = editor.changeAssessmentScoringType(legacy, "sum");
  assert.equal(unchanged.scoringPreset, "generic-sum-v1");
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

test("accepts only controlled assessment image references", () => {
  const digest = "a".repeat(64);
  const allowed = [
    "/images/content/assess/cover.jpg",
    "/static/assessments/legacy-cover.jpeg",
    "/static/assessments/results/result.gif",
    `/static/assessment-assets/${digest}.png`,
  ];
  for (const value of allowed) {
    assert.equal(editor.isSafeAssessmentAssetReference(value), true, value);
    assert.equal(editor.getAssessmentAssetReferenceError(value), null, value);
  }
  assert.equal(
    editor.getAssessmentAssetReferenceError("", { allowEmpty: true }),
    null,
  );

  const rejected = [
    "https://cdn.example.com/cover.jpg",
    "http://127.0.0.1/static/assessments/cover.jpg",
    "data:image/png;base64,abc",
    "blob:https://example.com/id",
    "javascript:alert(1)",
    "//cdn.example.com/cover.jpg",
    "/static/uploads/uncontrolled.png",
    "/images/content/cover.jpg?token=secret",
    "/images/content/cover.jpg#fragment",
    "/images/../private/cover.jpg",
    "/images/%2e%2e/private/cover.jpg",
    "/images/content/cover.svg",
    "/images/content/cover image.jpg",
    '/images/content/cover");evil=".jpg',
    `/${"a".repeat(501)}.jpg`,
  ];
  for (const value of rejected) {
    assert.equal(editor.isSafeAssessmentAssetReference(value), false, value);
    assert.match(
      editor.getAssessmentAssetReferenceError(value),
      /仅支持/,
      value,
    );
  }
});

test("rejects unsafe cover and report image references before saving", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("match"),
  );
  definition.cover = "https://cdn.example.com/cover.jpg";
  definition.matchResults[0].image = "data:image/png;base64,abc";
  definition.reportProfiles = [
    {
      id: "profile-1",
      title: "报告",
      description: "报告说明",
      suggestions: [],
      image: "/static/uploads/uncontrolled.png",
    },
  ];

  const imageIssues = editor
    .validateAssessmentDefinition(definition)
    .filter((issue) => issue.path === "cover" || issue.path.endsWith(".image"));
  assert.deepEqual(
    imageIssues.map((issue) => issue.path),
    ["cover", "matchResults[0].image", "reportProfiles[0].image"],
  );
  assert.ok(imageIssues.every((issue) => issue.message.includes("受控图片")));
});

test("keeps generic sum v1 definitions valid for legacy editing", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.scoringPreset = "generic-sum-v1";

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

test("requires every generic match result to be referenced", () => {
  const match = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("match"),
  );
  match.matchResults.push({
    id: "unused",
    title: "未引用结果",
    description: "不应发布",
    suggestions: [],
    image: "",
    shareText: "",
  });

  assert.ok(
    editor
      .validateAssessmentDefinition(match)
      .some((issue) => issue.message.includes("未被任何选项引用：unused")),
  );
});

test("requires a generic match definition to have a required question", () => {
  const match = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("match"),
  );
  match.questions.forEach((question) => {
    question.required = false;
  });

  assert.ok(
    editor
      .validateAssessmentDefinition(match)
      .some((issue) => issue.message.includes("至少需要一道必答题")),
  );
});

test("rejects reachable sum scores that have no report range", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.scoreRanges = [
    {
      min: 0,
      max: 0,
      level: "零分",
      description: "零分结果",
      suggestions: [],
    },
  ];

  assert.ok(
    editor
      .validateAssessmentDefinition(definition)
      .some(
        (issue) =>
          issue.path === "scoreRanges" &&
          issue.message.includes("未覆盖可达分值：1"),
      ),
  );
});

test("allows gaps that contain no reachable score", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.questions[0].options[1].value = 2;
  definition.scoreRanges = [
    {
      min: 0,
      max: 0,
      level: "零分",
      description: "零分结果",
      suggestions: [],
    },
    {
      min: 2,
      max: 2,
      level: "两分",
      description: "两分结果",
      suggestions: [],
    },
  ];

  assert.deepEqual(editor.validateAssessmentDefinition(definition), []);
});

test("includes an unanswered optional question as a reachable zero", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.questions[0].required = false;
  definition.questions[0].options = [
    { id: "q1-a", text: "一分", value: 1 },
    { id: "q1-b", text: "两分", value: 2 },
  ];
  definition.scoreRanges = [
    {
      min: 1,
      max: 2,
      level: "已作答",
      description: "已作答结果",
      suggestions: [],
    },
  ];

  assert.ok(
    editor
      .validateAssessmentDefinition(definition)
      .some((issue) => issue.message.includes("未覆盖可达分值：0")),
  );
});

test("normalizes generic sum v2 decimal reachability to two places", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.questions = [
    {
      id: "q1",
      text: "题目 1",
      required: true,
      options: [
        { id: "q1-a", text: "0.1", value: 0.1 },
        { id: "q1-b", text: "0.2", value: 0.2 },
      ],
    },
    {
      id: "q2",
      text: "题目 2",
      required: true,
      options: [
        { id: "q2-a", text: "0.2", value: 0.2 },
        { id: "q2-b", text: "0.3", value: 0.3 },
      ],
    },
  ];
  definition.scoreRanges = [
    {
      min: 0.3,
      max: 0.3,
      level: "命中",
      description: "精确命中",
      suggestions: [],
    },
    {
      min: 0.4,
      max: 0.5,
      level: "其他",
      description: "其他分值",
      suggestions: [],
    },
  ];

  assert.deepEqual(editor.validateAssessmentDefinition(definition), []);
});

test("enumerates rounded average dimension scores", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("dimension"),
  );
  definition.questions = [1, 2, 3].map((number) => ({
    id: `q${number}`,
    text: `题目 ${number}`,
    required: true,
    options: [
      { id: `q${number}-a`, text: "否", value: 0 },
      { id: `q${number}-b`, text: "是", value: 1 },
    ],
  }));
  definition.dimensions[0] = {
    ...definition.dimensions[0],
    title: "平均维度",
    questionIds: ["q1", "q2", "q3"],
    reverseQuestionIds: ["q1"],
    aggregate: "average",
    scoreRanges: [
      {
        min: 0,
        max: 0.33,
        level: "低",
        description: "低分",
        suggestions: [],
      },
      {
        min: 0.67,
        max: 1,
        level: "高",
        description: "高分",
        suggestions: [],
      },
    ],
  };

  const [summary] =
    editor.getAssessmentScoreCoverageSummaries(definition);
  assert.deepEqual(
    {
      minimum: summary.minimum,
      maximum: summary.maximum,
      reachableCount: summary.reachableCount,
      uncoveredScores: summary.uncoveredScores,
    },
    {
      minimum: 0,
      maximum: 1,
      reachableCount: 4,
      uncoveredScores: [],
    },
  );
});

test("normalizes dimension sum decimal reachability to two places", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("dimension"),
  );
  definition.questions = [
    {
      id: "q1",
      text: "题目 1",
      required: true,
      options: [
        { id: "q1-a", text: "0.1", value: 0.1 },
        { id: "q1-b", text: "0.2", value: 0.2 },
      ],
    },
    {
      id: "q2",
      text: "题目 2",
      required: true,
      options: [
        { id: "q2-a", text: "0.2", value: 0.2 },
        { id: "q2-b", text: "0.3", value: 0.3 },
      ],
    },
  ];
  definition.dimensions = [
    {
      id: "sum",
      title: "小数求和",
      questionIds: ["q1", "q2"],
      reverseQuestionIds: [],
      aggregate: "sum",
      scoreRanges: [
        {
          min: 0.3,
          max: 0.3,
          level: "命中",
          description: "精确命中",
          suggestions: [],
        },
        {
          min: 0.4,
          max: 0.5,
          level: "其他",
          description: "其他分值",
          suggestions: [],
        },
      ],
    },
  ];

  assert.deepEqual(editor.validateAssessmentDefinition(definition), []);
});

test("uses the fixed PSQI output domain for range coverage", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.scoringType = "psqi";
  definition.scoringPreset = "psqi-v1";
  definition.scoreRanges = [
    {
      min: 0,
      max: 17,
      level: "已覆盖",
      description: "已覆盖结果",
      suggestions: [],
    },
  ];

  const [summary] =
    editor.getAssessmentScoreCoverageSummaries(definition);
  assert.equal(summary.minimum, 0);
  assert.equal(summary.maximum, 18);
  assert.deepEqual(summary.uncoveredScores, [18]);
});

test("fails closed when exact score reachability exceeds the safety limit", () => {
  const definition = completeRequiredFields(
    editor.createDefaultAssessmentDefinition("sum"),
  );
  definition.questions = Array.from({ length: 17 }, (_, index) => ({
    id: `q${index + 1}`,
    text: `题目 ${index + 1}`,
    required: true,
    options: [
      { id: `q${index + 1}-a`, text: "零分", value: 0 },
      {
        id: `q${index + 1}-b`,
        text: "幂次分值",
        value: 2 ** index,
      },
    ],
  }));
  definition.scoreRanges = [
    {
      min: 0,
      max: 2 ** 17 - 1,
      level: "完整",
      description: "完整区间",
      suggestions: [],
    },
  ];

  assert.ok(
    editor
      .validateAssessmentDefinition(definition)
      .some((issue) => issue.message.includes("无法完成精确校验")),
  );
});
