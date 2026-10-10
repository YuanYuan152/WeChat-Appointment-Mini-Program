import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessmentFormula.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const formula = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("parses and evaluates formulas with precedence and parentheses", () => {
  const compiled = formula.compileDimensionFormula(
    "(q1 + q2) * q3",
    ["q1", "q2", "q3"],
  );
  assert.deepEqual(compiled.questionIds, ["q1", "q2", "q3"]);
  assert.equal(compiled.evaluate({ q1: 1, q2: 2, q3: 3 }), 9);
});

test("tracks question ids while a formula is being edited", () => {
  assert.deepEqual(
    formula.formulaQuestionIds("q1 + q2 +", ["q1", "q2", "q10"]),
    ["q1", "q2"],
  );
  assert.deepEqual(
    formula.formulaQuestionIds("q10", ["q1", "q10"]),
    ["q10"],
  );
});

test("removing a selected question also removes its adjacent operator", () => {
  assert.equal(
    formula.removeFormulaQuestionId("q1 + q2", "q2", ["q1", "q2"]),
    "q1",
  );
  assert.equal(
    formula.removeFormulaQuestionId("q1 + q2", "q1", ["q1", "q2"]),
    "q2",
  );
});

test("rejects invalid syntax and division by zero", () => {
  assert.throws(
    () => formula.compileDimensionFormula("q1 + (", ["q1"]),
    /不完整|括号|运算符结尾/,
  );
  const compiled = formula.compileDimensionFormula("q1 / q2", ["q1", "q2"]);
  assert.throws(() => compiled.evaluate({ q1: 1, q2: 0 }), /除以零/);
});
