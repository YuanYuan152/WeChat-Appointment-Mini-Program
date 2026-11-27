import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./demographic-answers.ts", import.meta.url);
const { outputText } = ts.transpileModule(await readFile(sourceUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: sourceUrl.pathname,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const gender = {
  id: "gender",
  text: "性别",
  inputType: "single",
  required: true,
  options: [
    { id: "gender-male", text: "男", value: "male" },
    { id: "gender-female", text: "女", value: "female" },
  ],
};
const grade = {
  id: "grade",
  text: "年级",
  inputType: "single",
  required: false,
  options: [
    { id: "grade-1", text: "一年级", value: 1 },
    { id: "grade-2", text: "二年级", value: 2 },
  ],
};
const hobbies = {
  id: "hobbies",
  text: "爱好",
  inputType: "multiple",
  required: false,
  options: [
    { id: "hobby-a", text: "运动", value: "sport" },
    { id: "hobby-b", text: "阅读", value: "reading" },
    { id: "hobby-c", text: "音乐", value: "music" },
  ],
  validation: { maxLength: 2 },
};
const age = {
  id: "age",
  text: "年龄",
  inputType: "number",
  required: true,
  validation: { min: 6, max: 18 },
};
const code = {
  id: "code",
  text: "编号",
  inputType: "text",
  required: false,
  validation: { minLength: 3, pattern: "[A-Z]\\d+" },
};
const birthday = { id: "birthday", text: "生日", inputType: "date", required: false };

test("values are compared like the backend", () => {
  assert.equal(lib.sameDemographicValue("female", "female"), true);
  assert.equal(lib.sameDemographicValue(2, 2), true);
  assert.equal(lib.sameDemographicValue("2", 2), false);
  assert.equal(lib.sameDemographicValue(1, true), false);
  assert.equal(lib.sameDemographicValue(true, true), true);
});

test("filled values are checked against options and validation", () => {
  assert.equal(lib.demographicValueIssue(gender, "female"), "");
  assert.equal(lib.demographicValueIssue(gender, "other"), "请选择有效的选项");
  assert.equal(lib.demographicValueIssue(grade, 2), "");
  assert.equal(lib.demographicValueIssue(grade, "2"), "请选择有效的选项");
  assert.equal(lib.demographicValueIssue(hobbies, ["sport", "music"]), "");
  assert.equal(lib.demographicValueIssue(hobbies, ["sport", "sport"]), "选项不能重复");
  assert.equal(lib.demographicValueIssue(hobbies, ["sport", "reading", "music"]), "最多选择 2 项");
  assert.equal(lib.demographicValueIssue(hobbies, ["swim"]), "包含无效的选项");
  assert.equal(lib.demographicValueIssue(age, 5), "不能小于 6");
  assert.equal(lib.demographicValueIssue(age, 19), "不能大于 18");
  assert.equal(lib.demographicValueIssue(age, 12), "");
  assert.equal(lib.demographicValueIssue(code, "A1"), "至少填写 3 个字");
  assert.equal(lib.demographicValueIssue(code, "abc"), "格式不正确");
  assert.equal(lib.demographicValueIssue(code, "A123"), "");
  assert.equal(lib.demographicValueIssue(birthday, "2026-02-30"), "请选择有效的日期");
  assert.equal(lib.demographicValueIssue(birthday, "2016-02-29"), "");
  // 未填写不算错误（必填与否由完整性检查负责）
  assert.equal(lib.demographicValueIssue(age, undefined), "");
  assert.equal(lib.demographicValueIssue(code, "   "), "");
});

test("completeness needs required answers and valid filled ones", () => {
  const questions = [gender, grade, hobbies, age];
  assert.equal(lib.areDemographicAnswersComplete(questions, {}), false);
  assert.equal(lib.areDemographicAnswersComplete(questions, { gender: "male" }), false);
  assert.equal(lib.areDemographicAnswersComplete(questions, { gender: "male", age: 10 }), true);
  assert.equal(
    lib.areDemographicAnswersComplete(questions, { gender: "male", age: 10, grade: 9 }),
    false,
  );
  assert.equal(lib.areDemographicAnswersComplete([], undefined), true);
  assert.equal(lib.areDemographicAnswersComplete([code], { code: "  " }), true);
});

test("submitted answers only keep filled values of current questions", () => {
  assert.deepEqual(
    lib.cleanDemographicAnswers([gender, grade, hobbies, code], {
      gender: "female",
      grade: undefined,
      hobbies: [],
      code: " ",
      removed: "old",
    }),
    { gender: "female" },
  );
});
