import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./counselorSchedule.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const testableSource = outputText.replace(
  /import \{ addLocalDays, getLocalDateValue, ROLLING_SCHEDULE_WINDOW_DAYS \} from ["']@\/lib\/date["'];/,
  `const ROLLING_SCHEDULE_WINDOW_DAYS = 30;
   const getLocalDateValue = () => "2026-07-17";
   const addLocalDays = (value, days) => {
     const [year, month, day] = value.split("-").map(Number);
     const date = new Date(Date.UTC(year, month - 1, day + days));
     return date.toISOString().slice(0, 10);
   };`,
);
assert.notEqual(testableSource, outputText, "date helpers import should be stubbed");
const schedules = await import(
  `data:text/javascript;base64,${Buffer.from(testableSource).toString("base64")}`
);

test("list mode requests the backend past_days window", () => {
  assert.deepEqual(
    schedules.toCounselorScheduleRequest(
      { mode: "list", start: "2026-06-20", days: 14, month: "2026-06" },
      "2026-07-17",
    ),
    { start: "2026-06-20", days: 14, pastDays: 27 },
  );
});

test("calendar mode requests a complete backend month", () => {
  assert.deepEqual(
    schedules.toCounselorScheduleRequest(
      { mode: "calendar", start: "2026-07-17", days: 14, month: "2026-04" },
      "2026-07-17",
    ),
    { days: 14, month: "2026-04" },
  );
});

test("an old message deep link opens its historical month", () => {
  assert.deepEqual(
    schedules.createCounselorScheduleQuery("2026-05-08", "2026-07-17"),
    {
      mode: "calendar",
      start: "2026-07-17",
      days: 14,
      month: "2026-05",
    },
  );
});
