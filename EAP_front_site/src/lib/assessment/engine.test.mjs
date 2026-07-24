import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./engine.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const engine = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function sumAssessment(scoringPreset = "generic-sum-v2") {
  return {
    scoringType: "sum",
    scoringPreset,
    reverseQuestionIds: ["q1"],
    questions: [
      {
        id: "q1",
        options: [
          { id: "q1-low", value: 0 },
          { id: "q1-high", value: 3 },
        ],
      },
      {
        id: "q2",
        options: [
          { id: "q2-low", value: 0 },
          { id: "q2-high", value: 2 },
        ],
      },
    ],
    scoreRanges: [
      {
        min: 0,
        max: 2,
        level: "低",
        description: "低分",
        suggestions: [],
      },
      {
        min: 3,
        max: 5,
        level: "高",
        description: "高分",
        suggestions: [],
      },
    ],
  };
}

test("generic sum applies configured reverse questions", () => {
  const result = engine.calculateScore(sumAssessment(), {
    q1: "q1-low",
    q2: "q2-high",
  });

  assert.equal(result.type, "sum");
  assert.equal(result.totalScore, 5);
  assert.equal(result.level, "高");
});

test("generic sum v1 preserves raw legacy behavior and ignores reverse ids", () => {
  const result = engine.calculateScore(sumAssessment("generic-sum-v1"), {
    q1: "q1-low",
    q2: "q2-high",
  });

  assert.equal(result.type, "sum");
  assert.equal(result.totalScore, 2);
  assert.equal(result.level, "低");
});

test("a missing generic sum preset falls back to legacy raw behavior", () => {
  const assessment = sumAssessment();
  delete assessment.scoringPreset;
  const result = engine.calculateScore(assessment, {
    q1: "q1-low",
    q2: "q2-high",
  });

  assert.equal(result.type, "sum");
  assert.equal(result.totalScore, 2);
});

test("generic sum v2 rounds the final total to two decimals", () => {
  const assessment = sumAssessment();
  assessment.reverseQuestionIds = [];
  assessment.questions = [
    {
      id: "q1",
      required: true,
      options: [
        { id: "q1-a", value: 0.1 },
        { id: "q1-b", value: 0.2 },
      ],
    },
    {
      id: "q2",
      required: true,
      options: [
        { id: "q2-a", value: 0.2 },
        { id: "q2-b", value: 0.3 },
      ],
    },
  ];
  assessment.scoreRanges = [
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

  const result = engine.calculateScore(assessment, {
    q1: "q1-a",
    q2: "q2-a",
  });

  assert.equal(result.type, "sum");
  assert.equal(result.totalScore, 0.3);
  assert.equal(result.level, "命中");
});

test("an unanswered optional reverse question still contributes zero", () => {
  const assessment = sumAssessment();
  assessment.questions[0].required = false;
  const result = engine.calculateScore(assessment, {
    q2: "q2-high",
  });

  assert.equal(result.type, "sum");
  assert.equal(result.totalScore, 2);
  assert.equal(result.level, "低");
});
