import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessment-share-state.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const shareState = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("accepts only the share code published for the current assessment", () => {
  assert.equal(
    shareState.verifiedIncomingAssessmentShareCode("as1.valid", "as1.valid"),
    "as1.valid"
  );
  assert.equal(
    shareState.verifiedIncomingAssessmentShareCode("as1.other", "as1.valid"),
    null
  );
  assert.equal(
    shareState.verifiedIncomingAssessmentShareCode(null, "as1.valid"),
    null
  );
  assert.equal(
    shareState.verifiedIncomingAssessmentShareCode("as1.valid", null),
    null
  );
});

test("uses both assessment id and URL as the poster source identity", () => {
  const first = shareState.assessmentShareSourceKey("aas", "https://a.test/scan");
  assert.notEqual(
    first,
    shareState.assessmentShareSourceKey("psqi", "https://a.test/scan")
  );
  assert.notEqual(
    first,
    shareState.assessmentShareSourceKey("aas", "https://b.test/scan")
  );
});

test("clears the previous poster whenever the source changes", () => {
  let state = shareState.createAssessmentPosterState("source-a");
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-started",
    sourceKey: "source-a",
    generation: 1,
  });
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-succeeded",
    sourceKey: "source-a",
    generation: 1,
    poster: {
      blob: "blob-a",
      objectUrl: "blob:preview-a",
      previewDataUrl: "data:image/png;base64,a",
    },
  });
  assert.equal(state.status, "ready");

  state = shareState.assessmentPosterReducer(state, {
    type: "source-changed",
    sourceKey: "source-b",
    generation: 2,
  });
  assert.deepEqual(state, {
    sourceKey: "source-b",
    generation: 2,
    status: "idle",
    poster: null,
    error: null,
  });
});

test("ignores a late poster result from an obsolete generation", () => {
  let state = shareState.createAssessmentPosterState("source-b");
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-started",
    sourceKey: "source-b",
    generation: 4,
  });
  const current = state;
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-succeeded",
    sourceKey: "source-a",
    generation: 3,
    poster: {
      blob: "stale",
      objectUrl: "blob:stale",
      previewDataUrl: "data:image/png;base64,stale",
    },
  });
  assert.strictEqual(state, current);
});

test("a retry clears the previous error and can become ready", () => {
  let state = shareState.createAssessmentPosterState("source-a");
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-started",
    sourceKey: "source-a",
    generation: 1,
  });
  state = shareState.assessmentPosterReducer(state, {
    type: "generation-failed",
    sourceKey: "source-a",
    generation: 1,
    error: "生成失败",
  });
  assert.equal(state.status, "error");
  assert.equal(state.error, "生成失败");

  state = shareState.assessmentPosterReducer(state, {
    type: "generation-started",
    sourceKey: "source-a",
    generation: 2,
  });
  assert.equal(state.status, "generating");
  assert.equal(state.error, null);

  state = shareState.assessmentPosterReducer(state, {
    type: "generation-succeeded",
    sourceKey: "source-a",
    generation: 2,
    poster: {
      blob: "blob-a",
      objectUrl: "blob:preview-a",
      previewDataUrl: "data:image/png;base64,a",
    },
  });
  assert.equal(state.status, "ready");
});

test("sanitizes the downloaded poster filename", () => {
  assert.equal(
    shareState.safeAssessmentShareFileName(' 测评/A:*?"<>| '),
    "测评-A--------分享海报.png"
  );
  assert.equal(
    shareState.safeAssessmentShareFileName("   "),
    "心理测评-分享海报.png"
  );
});
