import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessmentShareStats.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const stats = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("formats assessment share conversion rates as readable percentages", () => {
  assert.equal(stats.formatAssessmentConversionRate(0), "0%");
  assert.equal(stats.formatAssessmentConversionRate(0.3333), "33.33%");
  assert.equal(stats.formatAssessmentConversionRate(1.25), "125%");
});

test("does not render invalid conversion rates", () => {
  assert.equal(stats.formatAssessmentConversionRate(Number.NaN), "-");
  assert.equal(stats.formatAssessmentConversionRate(-0.1), "-");
});

test("builds one aggregate stats query with trimmed encoded filters", () => {
  assert.equal(stats.buildAssessmentShareStatsQuery({}), "");
  assert.equal(
    stats.buildAssessmentShareStatsQuery({
      assessmentId: " bsi 18/简版 ",
      startAt: "2026-07-22T16:00:00.000Z",
      endAt: "2026-07-23T15:59:59.999Z",
    }),
    "assessment_id=bsi+18%2F%E7%AE%80%E7%89%88&start_at=2026-07-22T16%3A00%3A00.000Z&end_at=2026-07-23T15%3A59%3A59.999Z",
  );
});
