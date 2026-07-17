import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./reviewFilters.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const reviewFilters = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("review reset clears filter and deep-link parameters", () => {
  const params = new URLSearchParams({
    category: "LEAVE",
    status: "APPROVED",
    leaveId: "17",
    messageId: "41",
    source: "dashboard",
  });

  assert.equal(
    reviewFilters.buildReviewsResetHref("/reviews", params),
    "/reviews?source=dashboard",
  );
});

test("review reset returns a clean pathname when no unrelated parameters remain", () => {
  const params = new URLSearchParams("category=EXEMPTION&status=PENDING&exemptionId=3&id=3");
  assert.equal(reviewFilters.buildReviewsResetHref("/reviews", params), "/reviews");
});
