import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessment-progress.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const progress = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const questions = [
  { id: "required-1", required: true },
  { id: "optional", required: false },
  { id: "required-2", required: true },
];

test("first start keeps the untouched attempt that may already carry QR attribution", () => {
  assert.equal(
    progress.shouldCreateFreshAssessmentAttempt({
      started: false,
      answeredCount: 0,
      completed: false,
    }),
    false,
  );
});

test("restart creates a new attempt after start, progress or completion", () => {
  assert.equal(
    progress.shouldCreateFreshAssessmentAttempt({
      started: true,
      answeredCount: 0,
      completed: false,
    }),
    true,
  );
  assert.equal(
    progress.shouldCreateFreshAssessmentAttempt({
      started: false,
      answeredCount: 1,
      completed: false,
    }),
    true,
  );
  assert.equal(
    progress.shouldCreateFreshAssessmentAttempt({
      started: false,
      answeredCount: 0,
      completed: true,
    }),
    true,
  );
});

test("allows completion when only optional questions are unanswered", () => {
  assert.equal(
    progress.areRequiredAssessmentQuestionsAnswered(questions, {
      "required-1": "a",
      "required-2": "b",
    }),
    true,
  );
});

test("blocks completion when a required question is unanswered", () => {
  assert.equal(
    progress.areRequiredAssessmentQuestionsAnswered(questions, {
      "required-1": "a",
    }),
    false,
  );
});

test("treats a missing required flag as required for legacy definitions", () => {
  assert.equal(
    progress.areRequiredAssessmentQuestionsAnswered(
      [{ id: "legacy" }],
      {},
    ),
    false,
  );
});

test("resume keeps the current skipped optional position", () => {
  assert.equal(
    progress.findAssessmentResumeQuestionIndex(
      questions,
      { "required-1": "a" },
      1,
    ),
    1,
  );
});

test("resume finds a required gap before an untouched optional fallback", () => {
  assert.equal(
    progress.findAssessmentResumeQuestionIndex(
      questions,
      { "required-1": "a" },
      0,
    ),
    2,
  );
  assert.equal(
    progress.findAssessmentResumeQuestionIndex(
      questions,
      {
        "required-1": "a",
        "required-2": "b",
      },
      0,
    ),
    1,
  );
});
