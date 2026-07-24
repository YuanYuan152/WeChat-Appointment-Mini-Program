import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./assessmentReport.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const report = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

function createSnapshot() {
  return {
    schemaVersion: 1,
    assessment: {
      schemaVersion: 1,
      id: "snapshot-assessment",
      version: 3,
      status: "published",
      category: "professional",
      title: "快照量表",
      subtitle: "",
      description: "",
      cover: "/static/cover.jpg",
      duration: 5,
      scoringType: "sum",
      scoringPreset: "generic-sum-v1",
      demographicQuestions: [
        {
          id: "gender",
          text: "性别",
          inputType: "single",
          required: true,
          options: [
            { id: "female", text: "女", value: "F" },
            { id: "male", text: "男", value: "M" },
          ],
        },
        {
          id: "channels",
          text: "了解渠道",
          inputType: "multiple",
          required: false,
          options: [
            { id: "friend", text: "朋友推荐", value: 1 },
            { id: "search", text: "网络搜索", value: 2 },
          ],
        },
        {
          id: "age",
          text: "年龄",
          inputType: "number",
          required: false,
        },
        {
          id: "empty",
          text: "选填项",
          inputType: "text",
          required: false,
        },
      ],
      questions: [
        {
          id: "q1",
          text: "快照中的题目一",
          required: true,
          options: [
            { id: "q1-a", text: "从不", value: 0 },
            { id: "q1-b", text: "经常", value: 3 },
          ],
        },
        {
          id: "q2",
          text: "快照中的题目二",
          required: false,
          options: [{ id: "q2-a", text: "是", value: 1 }],
        },
      ],
      scoreRanges: [
        {
          min: -2,
          max: 3,
          level: "低",
          description: "",
          suggestions: [],
        },
        {
          min: 4,
          max: 9,
          level: "高",
          description: "",
          suggestions: [],
        },
      ],
      disclaimer: "仅供参考",
    },
    result: {
      type: "sum",
      totalScore: 3,
      level: "低",
      description: "",
      suggestions: [],
    },
    reportContent: {
      title: "快照量表",
      subtitle: "",
      cover: "/static/cover.jpg",
      disclaimer: "仅供参考",
      reportIntro: "",
      features: "",
    },
    completedAt: "2026-07-23T03:00:00.000Z",
  };
}

test("converts date filters to China Standard Time day boundaries", () => {
  assert.equal(
    report.toChinaDayBoundaryIso("2026-07-23", "start"),
    "2026-07-22T16:00:00.000Z",
  );
  assert.equal(
    report.toChinaDayBoundaryIso("2026-07-23", "end"),
    "2026-07-23T15:59:59.999Z",
  );
  assert.equal(
    report.toAssessmentReportDateBoundary("2026-07-23", "start"),
    "2026-07-22T16:00:00.000Z",
  );
  assert.deepEqual(
    report.buildChinaDateFilterRange("2026-07-23", "2026-07-24"),
    {
      startAt: "2026-07-22T16:00:00.000Z",
      endAt: "2026-07-24T15:59:59.999Z",
    },
  );
});

test("omits empty and invalid date filters", () => {
  assert.equal(report.toChinaDayBoundaryIso("", "start"), undefined);
  assert.equal(report.toChinaDayBoundaryIso("2026-02-30", "end"), undefined);
  assert.equal(report.toChinaDayBoundaryIso("23/07/2026", "start"), undefined);
  assert.deepEqual(
    report.buildChinaDateFilterRange("invalid", "2026-07-23"),
    { endAt: "2026-07-23T15:59:59.999Z" },
  );
});

test("derives min and max from score ranges with a stable fallback", () => {
  const snapshot = createSnapshot();
  assert.deepEqual(
    report.getScoreRangeBounds(snapshot.assessment.scoreRanges),
    { min: -2, max: 9 },
  );
  assert.equal(report.getScoreRangeMin(snapshot.assessment.scoreRanges), -2);
  assert.equal(report.getScoreRangeMax(snapshot.assessment.scoreRanges), 9);
  assert.equal(report.getAssessmentRangeMax(snapshot.assessment.scoreRanges), 9);
  assert.deepEqual(report.getScoreRangeBounds([]), { min: 0, max: 100 });
  assert.deepEqual(report.getScoreRangeBounds(undefined), {
    min: 0,
    max: 100,
  });
});

test("maps raw answers using only the immutable report snapshot", () => {
  const snapshot = createSnapshot();
  const mapped = report.mapSnapshotAnswers(snapshot, {
    q1: "q1-b",
    q2: "removed-option",
    currentDefinitionOnlyQuestion: "new-option",
  });

  assert.deepEqual(mapped, [
    {
      questionId: "q1",
      questionText: "快照中的题目一",
      selectedOptionId: "q1-b",
      answerText: "经常",
      scoreValue: 3,
    },
    {
      questionId: "q2",
      questionText: "快照中的题目二",
      selectedOptionId: "removed-option",
      answerText: "未知选项（removed-option）",
      scoreValue: null,
    },
  ]);
  assert.equal(
    report.mapSnapshotAnswers(snapshot, {})[0].answerText,
    "未作答",
  );
  assert.deepEqual(
    report.mapAssessmentAnswers(snapshot.assessment, { q1: "q1-a" })[0],
    { id: "q1", label: "快照中的题目一", value: "从不" },
  );
});

test("maps demographic option values and free-form values from snapshot", () => {
  const snapshot = createSnapshot();
  assert.deepEqual(
    report.mapSnapshotDemographicAnswers(snapshot, {
      gender: "F",
      channels: [2, 1],
      age: 28,
    }),
    [
      {
        questionId: "gender",
        questionText: "性别",
        inputType: "single",
        answerText: "女",
      },
      {
        questionId: "channels",
        questionText: "了解渠道",
        inputType: "multiple",
        answerText: "网络搜索、朋友推荐",
      },
      {
        questionId: "age",
        questionText: "年龄",
        inputType: "number",
        answerText: "28",
      },
      {
        questionId: "empty",
        questionText: "选填项",
        inputType: "text",
        answerText: "未填写",
      },
    ],
  );
  assert.deepEqual(
    report.mapDemographicAnswers(snapshot.assessment, { gender: "M" })[0],
    { id: "gender", label: "性别", value: "男" },
  );
});

test("resolves only controlled assessment assets without browser globals", () => {
  const rejected = [
    "https://cdn.example.com/cover.jpg",
    "http://cdn.example.com/cover.jpg",
    "data:image/png;base64,abc",
    "blob:https://example.com/id",
    "//cdn.example.com/cover.jpg",
    "javascript:alert(1)",
    "/static/uploads/uncontrolled.png",
    "/images/content/cover.jpg?token=secret",
    "/images/%2e%2e/private/cover.jpg",
    "/images/content/cover.svg",
    '/images/content/cover");evil=".jpg',
  ];
  for (const value of rejected) {
    assert.equal(report.resolveAssessmentAssetUrl(value), "", value);
  }

  assert.equal(
    report.resolveAssessmentAssetUrl("/images/content/cover.jpg", {
      eapBaseUrl: "https://eap.example.com/assessment",
    }),
    "https://eap.example.com/images/content/cover.jpg",
  );
  assert.equal(
    report.resolveAssessmentAssetUrl("/static/assessments/cover.jpg", {
      apiBaseUrl: "https://api.example.com/api/",
      eapBaseUrl: "https://eap.example.com/assessment",
    }),
    "https://api.example.com/static/assessments/cover.jpg",
  );
  assert.equal(
    report.resolveAssessmentAssetUrl("/images/content/cover.jpg", {
      eapBaseUrl: "/assessment/",
      sameOriginBaseUrl: "https://admin.example.com/",
    }),
    "https://admin.example.com/images/content/cover.jpg",
  );

  const managedPath =
    `/static/assessment-assets/${"a".repeat(64)}.webp`;
  assert.equal(
    report.resolveAssessmentAssetUrl(managedPath, {
      apiBaseUrl: "https://api.example.com/api/",
      eapBaseUrl: "https://eap.example.com/",
    }),
    `https://api.example.com${managedPath}`,
  );
  assert.equal(
    report.resolveAssessmentAssetUrl(managedPath, {
      sameOriginBaseUrl: "https://admin.example.com/admin/",
    }),
    `https://admin.example.com${managedPath}`,
  );

  const trustedEapAbsolute =
    "https://eap.example.com/images/content/cover.jpg";
  const trustedApiLegacyAbsolute =
    "https://api.example.com/static/assessments/cover.jpg";
  const trustedApiManagedAbsolute = `https://api.example.com${managedPath}`;
  const configuredBases = {
    apiBaseUrl: "https://api.example.com/api/",
    eapBaseUrl: "https://eap.example.com/assessment/",
    sameOriginBaseUrl: "https://admin.example.com/admin/",
  };
  assert.equal(
    report.resolveAssessmentAssetUrl(trustedEapAbsolute, configuredBases),
    trustedEapAbsolute,
  );
  assert.equal(
    report.resolveAssessmentAssetUrl(
      trustedApiLegacyAbsolute,
      configuredBases,
    ),
    trustedApiLegacyAbsolute,
  );
  assert.equal(
    report.resolveAssessmentAssetUrl(trustedApiManagedAbsolute, configuredBases),
    trustedApiManagedAbsolute,
  );
  assert.equal(
    report.resolveAssessmentAssetUrl(
      "https://admin.example.com/images/content/cover.jpg",
      configuredBases,
    ),
    "https://admin.example.com/images/content/cover.jpg",
  );

  const untrustedAbsolute = [
    "https://api.example.com/images/content/cover.jpg",
    "https://eap.example.com/static/assessments/cover.jpg",
    `https://eap.example.com${managedPath}`,
    "https://eap.example.com.evil.test/images/content/cover.jpg",
    "https://api.example.com.evil.test/static/assessments/cover.jpg",
    "https://external.example.com/images/content/cover.jpg",
  ];
  for (const value of untrustedAbsolute) {
    assert.equal(
      report.resolveAssessmentAssetUrl(value, {
        apiBaseUrl: configuredBases.apiBaseUrl,
        eapBaseUrl: configuredBases.eapBaseUrl,
      }),
      "",
      value,
    );
  }

  assert.equal(
    report.resolveAssessmentAssetUrl("/images/content/cover.jpg"),
    "/images/content/cover.jpg",
  );
  assert.equal(report.resolveAssessmentAssetUrl(undefined), "");
});
