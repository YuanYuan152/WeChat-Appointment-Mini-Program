import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTsModule(url) {
  const source = await readFile(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: url.pathname,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}

const answerLib = await loadTsModule(
  new URL("./assessment-answer.ts", import.meta.url),
);
const onboardingLib = await loadTsModule(
  new URL(
    "../../../../../EAP_site/zhongjian_site/src/lib/onboarding-answers.ts",
    import.meta.url,
  ),
);

const choiceWithFollowUp = {
  id: "q1",
  text: "最近睡眠如何",
  required: true,
  inputType: "choice",
  options: [
    {
      id: "bad",
      text: "较差",
      value: 1,
      followUp: {
        inputType: "number",
        label: "失眠天数",
        required: true,
        scoreMode: "value",
        validation: { min: 1, max: 7 },
      },
    },
    {
      id: "other",
      text: "其他说明",
      value: 2,
      followUp: {
        inputType: "text",
        label: "可补充",
        required: false,
        scoreMode: "filled",
        validation: { minLength: 2, maxLength: 10 },
      },
    },
    { id: "good", text: "良好", value: 0 },
  ],
};

const textQuestion = {
  id: "q2",
  text: "最想改善的一点",
  required: true,
  inputType: "text",
  validation: { minLength: 2, maxLength: 20 },
  options: [],
};

const numberQuestion = {
  id: "q3",
  text: "本周运动次数",
  required: true,
  inputType: "number",
  validation: { min: 0, max: 7 },
  options: [],
};

test("EAP_front_site validates choice, follow-up, text, and number answers", () => {
  assert.equal(answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, "good"), true);
  assert.equal(answerLib.canAutoAdvanceAfterAnswer(choiceWithFollowUp, "good"), true);

  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, { optionId: "bad" }),
    false,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, {
      optionId: "bad",
      followUp: 0,
    }),
    false,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, {
      optionId: "bad",
      followUp: 3,
    }),
    true,
  );
  assert.equal(
    answerLib.canAutoAdvanceAfterAnswer(choiceWithFollowUp, {
      optionId: "bad",
      followUp: 3,
    }),
    false,
  );

  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, {
      optionId: "other",
    }),
    true,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, {
      optionId: "other",
      followUp: "a",
    }),
    false,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(choiceWithFollowUp, {
      optionId: "other",
      followUp: "工作压力",
    }),
    true,
  );

  assert.equal(answerLib.isAssessmentAnswerPresent(textQuestion, { text: " " }), false);
  assert.equal(answerLib.isAssessmentAnswerPresent(textQuestion, { text: "好" }), false);
  assert.equal(
    answerLib.isAssessmentAnswerPresent(textQuestion, { text: "改善作息" }),
    true,
  );

  assert.equal(
    answerLib.isAssessmentAnswerPresent(numberQuestion, { number: -1 }),
    false,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(numberQuestion, { number: 8 }),
    false,
  );
  assert.equal(
    answerLib.isAssessmentAnswerPresent(numberQuestion, { number: 4 }),
    true,
  );
});

test("zhongjian_site serializes choice, follow-up, text, and number answers for backend", () => {
  assert.equal(
    onboardingLib.serializeDynamicQuestionAnswer(choiceWithFollowUp, "good"),
    "good",
  );
  assert.equal(
    onboardingLib.serializeDynamicQuestionAnswer(choiceWithFollowUp, {
      optionId: "bad",
    }),
    undefined,
  );
  assert.deepEqual(
    onboardingLib.serializeDynamicQuestionAnswer(choiceWithFollowUp, {
      optionId: "bad",
      followUp: 3,
    }),
    { optionId: "bad", followUp: 3 },
  );
  assert.deepEqual(
    onboardingLib.serializeDynamicQuestionAnswer(choiceWithFollowUp, {
      optionId: "other",
    }),
    { optionId: "other" },
  );
  assert.deepEqual(
    onboardingLib.serializeDynamicQuestionAnswer(textQuestion, {
      text: "改善睡眠",
    }),
    { text: "改善睡眠" },
  );
  assert.deepEqual(
    onboardingLib.serializeDynamicQuestionAnswer(numberQuestion, { number: 5 }),
    { number: 5 },
  );
});
