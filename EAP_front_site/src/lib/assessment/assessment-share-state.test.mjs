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

test("creates separate link and poster share payloads", () => {
  assert.deepEqual(
    shareState.createAssessmentLinkSharePayload(
      "睡眠质量测评",
      "https://eap.example/scan?code=valid"
    ),
    {
      title: "睡眠质量测评",
      text: "邀请你完成「睡眠质量测评」心理测评",
      url: "https://eap.example/scan?code=valid",
    }
  );

  const file = { name: "poster.png" };
  assert.deepEqual(shareState.createAssessmentPosterSharePayload(file), {
    files: [file],
  });
});

test("recognizes WeChat user agents without matching ordinary browsers", () => {
  assert.equal(
    shareState.isWechatUserAgent(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit MicroMessenger/8.0.50"
    ),
    true
  );
  assert.equal(
    shareState.isWechatUserAgent(
      "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile Safari/604.1"
    ),
    false
  );
});

test("maps share errors to actionable messages", () => {
  assert.equal(
    shareState.assessmentShareErrorMessage({ name: "AbortError" }, "link"),
    null
  );
  assert.equal(
    shareState.assessmentShareErrorMessage({ name: "NotAllowedError" }, "link"),
    "浏览器未允许分享，请确认使用 HTTPS，或复制链接后发送"
  );
  assert.equal(
    shareState.assessmentShareErrorMessage({ name: "DataError" }, "poster"),
    "微信或当前应用无法接收该图片，请保存海报后发送"
  );
  assert.equal(
    shareState.assessmentShareErrorMessage({ name: "TypeError" }, "link"),
    "当前浏览器不支持链接分享，请复制链接后发送"
  );
  assert.equal(
    shareState.assessmentShareErrorMessage(new Error("unknown"), "poster"),
    "图片分享失败，请保存海报后发送"
  );
});
