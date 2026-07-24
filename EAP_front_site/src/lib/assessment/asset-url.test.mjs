import assert from "node:assert/strict";
import test from "node:test";

import { resolveAssessmentAssetUrl } from "./asset-url.ts";

const API_BASE_URL = "https://api.example.com/base/";

test("keeps trusted EAP-local raster images relative", () => {
  assert.equal(
    resolveAssessmentAssetUrl(
      "/images/content/assess/assess-bsi-18.jpg",
      { apiBaseUrl: API_BASE_URL },
    ),
    "/images/content/assess/assess-bsi-18.jpg",
  );
  assert.equal(
    resolveAssessmentAssetUrl("/images/results/profile.gif", {
      apiBaseUrl: API_BASE_URL,
    }),
    "/images/results/profile.gif",
  );
});

test("resolves controlled assessment assets against the API origin", () => {
  const digest = "a".repeat(64);
  assert.equal(
    resolveAssessmentAssetUrl(
      `/static/assessment-assets/${digest}.webp`,
      { apiBaseUrl: API_BASE_URL },
    ),
    `https://api.example.com/static/assessment-assets/${digest}.webp`,
  );
  assert.equal(
    resolveAssessmentAssetUrl("/static/assessments/cover.png", {
      apiBaseUrl: API_BASE_URL,
    }),
    "https://api.example.com/static/assessments/cover.png",
  );
});

test("accepts legacy absolute URLs only on the configured API origin", () => {
  const digest = "b".repeat(64);
  assert.equal(
    resolveAssessmentAssetUrl(
      "https://api.example.com/static/assessments/legacy.jpg",
      { apiBaseUrl: API_BASE_URL },
    ),
    "https://api.example.com/static/assessments/legacy.jpg",
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      "https://cdn.example.com/static/assessments/legacy.jpg",
      { apiBaseUrl: API_BASE_URL },
    ),
    null,
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      "http://api.example.com/static/assessments/legacy.jpg",
      { apiBaseUrl: API_BASE_URL },
    ),
    null,
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      `https://api.example.com/static/assessment-assets/${digest}.png`,
      { apiBaseUrl: API_BASE_URL },
    ),
    `https://api.example.com/static/assessment-assets/${digest}.png`,
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      `https://api.example.com/static/assessment-assets/${digest.toUpperCase()}.png`,
      { apiBaseUrl: API_BASE_URL },
    ),
    null,
  );
});

test("accepts historical EAP-local absolute images only on the exact current origin", () => {
  const options = {
    apiBaseUrl: API_BASE_URL,
    sameOriginBaseUrl: "https://eap.example.com/assessment/",
  };
  assert.equal(
    resolveAssessmentAssetUrl(
      "https://eap.example.com/images/content/assess/legacy.jpg",
      options,
    ),
    "/images/content/assess/legacy.jpg",
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      "https://eap.example.com.evil.test/images/content/assess/legacy.jpg",
      options,
    ),
    null,
  );
  assert.equal(
    resolveAssessmentAssetUrl(
      "https://eap.example.com/images/../private/legacy.jpg",
      options,
    ),
    null,
  );
});

test("rejects unsafe schemes, protocol-relative URLs and uncontrolled paths", () => {
  const unsafe = [
    "data:image/png;base64,abc",
    "blob:https://api.example.com/id",
    "javascript:alert(1)",
    "file:///tmp/secret.png",
    "//api.example.com/static/assessments/cover.png",
    "/static/uploads/legacy.png",
    "/api/private/avatar.png",
    "images/content/assess/cover.jpg",
  ];

  for (const value of unsafe) {
    assert.equal(
      resolveAssessmentAssetUrl(value, { apiBaseUrl: API_BASE_URL }),
      null,
      value,
    );
  }
});

test("rejects traversal, encoded, query, fragment and non-raster paths", () => {
  const unsafe = [
    "/images/../secret.jpg",
    "/images/%2e%2e/secret.jpg",
    "/static/assessment-assets/cover.jpg?version=1",
    "/static/assessment-assets/cover.jpg#preview",
    "/static/assessment-assets/folder//cover.jpg",
    String.raw`/static/assessment-assets/folder\cover.jpg`,
    "/static/assessment-assets/vector.svg",
    "/static/assessment-assets/no-extension",
    "/static/assessment-assets/not-a-content-hash.png",
  ];

  for (const value of unsafe) {
    assert.equal(
      resolveAssessmentAssetUrl(value, { apiBaseUrl: API_BASE_URL }),
      null,
      value,
    );
  }
});

test("returns null for empty values or missing and malformed API configuration", () => {
  assert.equal(resolveAssessmentAssetUrl("", { apiBaseUrl: API_BASE_URL }), null);
  assert.equal(resolveAssessmentAssetUrl(null, { apiBaseUrl: API_BASE_URL }), null);
  assert.equal(
    resolveAssessmentAssetUrl("/static/assessments/cover.jpg", {
      apiBaseUrl: null,
    }),
    null,
  );
  assert.equal(
    resolveAssessmentAssetUrl("/static/assessments/cover.jpg", {
      apiBaseUrl: "not-a-url",
    }),
    null,
  );
});
