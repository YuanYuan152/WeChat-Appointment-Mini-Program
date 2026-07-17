import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./pricing.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const pricing = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("integer draft supports empty and negative typing states", () => {
  assert.equal(pricing.isIntegerDraft("", true), true);
  assert.equal(pricing.isIntegerDraft("-", true), true);
  assert.equal(pricing.isIntegerDraft("-80", true), true);
  assert.equal(pricing.parseIntegerDraft("-"), null);
  assert.equal(pricing.parseIntegerDraft("-080"), -80);
  assert.equal(pricing.normalizeIntegerDraft("080"), "80");
});

test("three party preview follows the mini-program split rule", () => {
  const preview = pricing.calculateThreePartyShare(680, 60);
  assert.deepEqual(preview, {
    displayPriceYuan: 680,
    counselorShareYuan: 408,
    platformShareYuan: 272,
    hospitalShareYuan: 0,
    counselorSharePercent: 60,
    platformSharePercent: 40,
    hospitalSharePercent: 0,
  });
});

test("three party cent values always add up to the visible price", () => {
  const preview = pricing.calculateThreePartyShareFromCents(59_900, 19_700);
  assert.equal(
    preview.counselorShareCents +
      preview.platformShareCents +
      preview.hospitalShareCents,
    preview.displayPriceCents,
  );
  assert.equal(preview.hospitalShareCents, 0);
});

test("single counselor pricing update keeps percentage semantics", () => {
  const payload = pricing.buildCounselorPercentPricingUpdate(680, 60);
  assert.deepEqual(payload, {
    basePriceYuan: 680,
    defaultRevenueSharePercent: 60,
  });
  assert.equal("defaultRevenueShareYuan" in payload, false);
});
