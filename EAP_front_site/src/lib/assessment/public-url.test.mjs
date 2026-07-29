import assert from "node:assert/strict";
import test from "node:test";

import {
  assessmentCanonicalUrl,
  assessmentMetadataImageUrl,
  assessmentPublicSiteOrigin,
} from "./public-url.ts";

test("uses only a clean HTTPS origin for public metadata", () => {
  assert.equal(
    assessmentPublicSiteOrigin("https://eap.example.com").toString(),
    "https://eap.example.com/",
  );
  assert.equal(
    assessmentPublicSiteOrigin("http://124.221.56.121").toString(),
    "https://eap.ji-psy.com/",
  );
  assert.equal(
    assessmentPublicSiteOrigin("javascript:alert(1)").toString(),
    "https://eap.ji-psy.com/",
  );
  assert.equal(
    assessmentPublicSiteOrigin("https://user:secret@eap.example.com").toString(),
    "https://eap.ji-psy.com/",
  );
});

test("builds category-specific canonical URLs without share parameters", () => {
  assert.equal(
    assessmentCanonicalUrl(
      "professional",
      "bsi-18",
      "https://eap.example.com",
    ).toString(),
    "https://eap.example.com/assessment/professional/bsi-18",
  );
  assert.equal(
    assessmentCanonicalUrl(
      "fun",
      "dark-light-personality",
      "https://eap.example.com",
    ).toString(),
    "https://eap.example.com/assessment/fun/dark-light-personality",
  );
  assert.throws(
    () =>
      assessmentCanonicalUrl(
        "fun",
        "../reports",
        "https://eap.example.com",
      ),
    /量表 ID/,
  );
});

test("keeps metadata images HTTPS and falls back for unsafe covers", () => {
  assert.equal(
    assessmentMetadataImageUrl(
      "/images/content/assess/assess-bsi-18.jpg",
      "https://eap.example.com",
    ).toString(),
    "https://eap.example.com/images/content/assess/assess-bsi-18.jpg",
  );
  assert.equal(
    assessmentMetadataImageUrl(
      "https://api.example.com/static/assessment-assets/cover.png",
      "https://eap.example.com",
    ).toString(),
    "https://api.example.com/static/assessment-assets/cover.png",
  );
  assert.equal(
    assessmentMetadataImageUrl(
      "http://127.0.0.1:8000/static/assessment-assets/cover.png",
      "https://eap.example.com",
    ).toString(),
    "https://eap.example.com/images/content/assess-color-cover.jpg",
  );
  assert.equal(
    assessmentMetadataImageUrl(
      "data:image/png;base64,unsafe",
      "https://eap.example.com",
    ).toString(),
    "https://eap.example.com/images/content/assess-color-cover.jpg",
  );
});
