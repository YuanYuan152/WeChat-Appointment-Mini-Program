import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./messageNavigation.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const testableSource = outputText.replace(
  /import \{ sectionPathById \} from ["']@\/config\/navigation["'];/,
  'const sectionPathById = { refunds: "/reviews" };',
);
assert.notEqual(testableSource, outputText, "navigation route import should be stubbed");
const navigation = await import(
  `data:text/javascript;base64,${Buffer.from(testableSource).toString("base64")}`
);

function leaveMessage(detail) {
  return {
    Id: 41,
    RelatedType: "COUNSELOR_LEAVE",
    RelatedId: 17,
    Content: JSON.stringify({ summary: "请假申请", detail }),
  };
}

test("approved leave message links to the approved review result", () => {
  const target = navigation.resolveMessageActionTarget(
    leaveMessage({ status: "APPROVED", leaveRequestId: 17 }),
    "Admin",
  );
  const url = new URL(target.href, "http://admin.test");

  assert.equal(url.pathname, "/reviews");
  assert.equal(url.searchParams.get("category"), "LEAVE");
  assert.equal(url.searchParams.get("status"), "APPROVED");
  assert.equal(url.searchParams.get("leaveId"), "17");
  assert.equal(target.label, "查看请假审核结果");
});

test("rejected leave message links to the rejected review result", () => {
  const target = navigation.resolveMessageActionTarget(
    leaveMessage({ status: "rejected", leaveRequestId: 18 }),
    "Assistant",
  );
  const url = new URL(target.href, "http://admin.test");

  assert.equal(url.searchParams.get("status"), "REJECTED");
  assert.equal(url.searchParams.get("leaveId"), "18");
  assert.equal(target.label, "查看请假审核结果");
});

test("historical approved flag and missing status remain compatible", () => {
  assert.equal(
    navigation.leaveReviewStatusFromDetail({ approved: true }),
    "APPROVED",
  );
  assert.equal(navigation.leaveReviewStatusFromDetail({}), "PENDING");

  const pendingTarget = navigation.resolveMessageActionTarget(
    leaveMessage({ leaveRequestId: 19 }),
    "Ops",
  );
  const url = new URL(pendingTarget.href, "http://admin.test");
  assert.equal(url.searchParams.get("status"), "PENDING");
  assert.equal(pendingTarget.label, "前往请假审核");
});

test("unrelated message still has no review navigation target", () => {
  const target = navigation.resolveMessageActionTarget(
    {
      Id: 42,
      RelatedType: "SYSTEM_NOTICE",
      RelatedId: 99,
      Content: JSON.stringify({ detail: { status: "APPROVED" } }),
    },
    "Admin",
  );

  assert.equal(target, null);
});
