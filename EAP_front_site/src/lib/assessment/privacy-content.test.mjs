import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const storage = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const {
  ASSESSMENT_PRIVACY_VERSION,
  acceptProfessionalAssessmentPrivacy,
  isProfessionalAssessmentPrivacyAccepted,
} = await import("./privacy-content.ts");

beforeEach(() => {
  storage.clear();
});

test("professional privacy consent is isolated by account", () => {
  assert.equal(acceptProfessionalAssessmentPrivacy(101), true);
  assert.equal(isProfessionalAssessmentPrivacyAccepted(101), true);
  assert.equal(isProfessionalAssessmentPrivacyAccepted(202), false);
});

test("missing account and the legacy global key never grant consent", () => {
  storage.set(
    "assessment-professional-privacy-accepted",
    JSON.stringify({
      version: ASSESSMENT_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
    }),
  );

  assert.equal(isProfessionalAssessmentPrivacyAccepted(), false);
  assert.equal(isProfessionalAssessmentPrivacyAccepted(null), false);
  assert.equal(isProfessionalAssessmentPrivacyAccepted(101), false);
});

test("stale or mismatched consent records are rejected", () => {
  storage.set(
    "assessment-professional-privacy-accepted:101",
    JSON.stringify({
      accountId: 202,
      version: ASSESSMENT_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
    }),
  );
  assert.equal(isProfessionalAssessmentPrivacyAccepted(101), false);

  storage.set(
    "assessment-professional-privacy-accepted:101",
    JSON.stringify({
      accountId: 101,
      version: "old-version",
      acceptedAt: new Date().toISOString(),
    }),
  );
  assert.equal(isProfessionalAssessmentPrivacyAccepted(101), false);
});
