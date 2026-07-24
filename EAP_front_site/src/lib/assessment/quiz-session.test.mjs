import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const { useQuizSession } = await import("../stores/quiz-session.ts");

beforeEach(() => {
  storage.clear();
  useQuizSession.getState().clearAllSessions();
});

test("a report requires an explicit ready marker for the current version", () => {
  const assessmentId = "optional-only-test";
  const state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  state.markStarted(assessmentId);
  assert.equal(
    useQuizSession.getState().isReadyToSubmit(assessmentId, 1),
    false,
  );

  useQuizSession.getState().markReadyToSubmit(assessmentId, 1);
  assert.equal(
    useQuizSession.getState().isReadyToSubmit(assessmentId, 1),
    true,
  );
});

test("changing the published version clears answers and creates a new attempt", () => {
  const assessmentId = "version-change-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  state.markStarted(assessmentId);
  state.setAnswer(assessmentId, "q1", "q1-a");
  state.markReadyToSubmit(assessmentId, 1);
  const firstAttemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  useQuizSession
    .getState()
    .setShareCode(assessmentId, 1, firstAttemptId, "as1.version-one");
  assert.equal(
    useQuizSession
      .getState()
      .getShareCode(assessmentId, 1, firstAttemptId),
    "as1.version-one",
  );

  useQuizSession.getState().ensureVersion(assessmentId, 2);
  state = useQuizSession.getState();
  const secondAttemptId = state.getAttemptId(assessmentId, 2);

  assert.deepEqual(state.getAnswers(assessmentId, 2), {});
  assert.equal(state.hasStarted(assessmentId, 2), false);
  assert.equal(state.isReadyToSubmit(assessmentId, 2), false);
  assert.notEqual(secondAttemptId, firstAttemptId);
  assert.equal(state.getAttemptId(assessmentId, 1), undefined);
  assert.equal(
    state.getShareCode(assessmentId, 1, firstAttemptId),
    undefined,
  );
  assert.equal(
    state.getShareCode(assessmentId, 2, secondAttemptId),
    undefined,
  );
});

test("switching accounts clears persisted answers and submission state", () => {
  const assessmentId = "account-change-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  state.markStarted(assessmentId);
  state.setAnswer(assessmentId, "q1", "q1-a");
  state.markReadyToSubmit(assessmentId, 1);
  const firstAttemptId = state.getAttemptId(assessmentId, 1);
  state.setShareCode(
    assessmentId,
    1,
    firstAttemptId,
    "as1.account-one",
  );

  assert.equal(state.isAccountSessionOwner(101), true);
  assert.equal(state.getAnsweredCount(assessmentId, 1), 1);
  assert.equal(state.isReadyToSubmit(assessmentId, 1), true);
  assert.equal(
    state.getShareCode(assessmentId, 1, firstAttemptId),
    "as1.account-one",
  );

  state.ensureAccount(202);
  state = useQuizSession.getState();

  assert.equal(state.isAccountSessionOwner(101), false);
  assert.equal(state.isAccountSessionOwner(202), true);
  assert.deepEqual(state.getAnswers(assessmentId, 1), {});
  assert.equal(state.getAttemptId(assessmentId, 1), undefined);
  assert.equal(state.hasStarted(assessmentId, 1), false);
  assert.equal(state.isReadyToSubmit(assessmentId, 1), false);
  assert.equal(
    state.getShareCode(assessmentId, 1, firstAttemptId),
    undefined,
  );
});

test("opening the same version normally preserves attribution for the same attempt", () => {
  const assessmentId = "resume-attribution-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const attemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(assessmentId, 1, attemptId, "as1.resume");
  state.markStarted(assessmentId);
  state.setAnswer(assessmentId, "q1", "q1-a");

  useQuizSession.getState().ensureAccount(101);
  useQuizSession.getState().ensureVersion(assessmentId, 1);
  state = useQuizSession.getState();

  assert.equal(state.getAttemptId(assessmentId, 1), attemptId);
  assert.equal(
    state.getShareCode(assessmentId, 1, attemptId),
    "as1.resume",
  );
  assert.equal(state.getAnsweredCount(assessmentId, 1), 1);
});

test("first scanned start preserves attribution on the untouched attempt", () => {
  const assessmentId = "first-scanned-start-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const attemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(assessmentId, 1, attemptId, "as1.first-scan");

  // QuizClient deliberately does not clear an untouched attempt on the first
  // "开始答题" click.
  state.markStarted(assessmentId);
  state = useQuizSession.getState();

  assert.equal(state.getAttemptId(assessmentId, 1), attemptId);
  assert.equal(
    state.getShareCode(assessmentId, 1, attemptId),
    "as1.first-scan",
  );
});

test("bound attribution survives persistence for the same account, version and attempt", async () => {
  const assessmentId = "persisted-attribution-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const attemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(assessmentId, 1, attemptId, "as1.persisted");
  const persisted = storage.get("quiz-session-v2");
  assert.ok(persisted);

  state.clearAllSessions();
  storage.set("quiz-session-v2", persisted);
  await useQuizSession.persist.rehydrate();
  state = useQuizSession.getState();

  assert.equal(state.isAccountSessionOwner(101), true);
  assert.equal(state.getAttemptId(assessmentId, 1), attemptId);
  assert.equal(
    state.getShareCode(assessmentId, 1, attemptId),
    "as1.persisted",
  );
});

test("ordinary page restart creates an unattributed attempt", () => {
  const assessmentId = "new-attempt-attribution-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const firstAttemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(
    assessmentId,
    1,
    firstAttemptId,
    "as1.first-attempt",
  );

  state.clearSession(assessmentId, 1);
  state = useQuizSession.getState();
  const secondAttemptId = state.getAttemptId(assessmentId, 1);

  assert.notEqual(secondAttemptId, firstAttemptId);
  assert.equal(
    state.getShareCode(assessmentId, 1, firstAttemptId),
    undefined,
  );
  assert.equal(
    state.getShareCode(assessmentId, 1, secondAttemptId),
    undefined,
  );
});

test("verified QR page can rebind the same code after creating a new attempt", () => {
  const assessmentId = "qr-restart-attribution-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const firstAttemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(
    assessmentId,
    1,
    firstAttemptId,
    "as1.verified-qr",
  );

  state.clearSession(assessmentId, 1);
  state = useQuizSession.getState();
  const secondAttemptId = state.getAttemptId(assessmentId, 1);
  assert.equal(
    state.getShareCode(assessmentId, 1, secondAttemptId),
    undefined,
  );

  // AssessmentShareAttribution observes attemptId and performs this binding
  // again only while the URL still carries the verified QR code.
  state.setShareCode(
    assessmentId,
    1,
    secondAttemptId,
    "as1.verified-qr",
  );
  state = useQuizSession.getState();

  assert.notEqual(secondAttemptId, firstAttemptId);
  assert.equal(
    state.getShareCode(assessmentId, 1, secondAttemptId),
    "as1.verified-qr",
  );
});

test("clearing all sessions removes every bound attribution", () => {
  const assessmentId = "clear-all-attribution-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  const attemptId = useQuizSession
    .getState()
    .getAttemptId(assessmentId, 1);
  state = useQuizSession.getState();
  state.setShareCode(assessmentId, 1, attemptId, "as1.clear-all");

  state.clearAllSessions();
  state = useQuizSession.getState();

  assert.deepEqual(state.shareAttributions, {});
  assert.equal(
    state.getShareCode(assessmentId, 1, attemptId),
    undefined,
  );
});

test("legacy unbound persisted share codes fail closed after hydration", async () => {
  const assessmentId = "legacy-unbound-attribution-test";
  const attemptId = "legacy-attempt-id";
  storage.set(
    "quiz-session-v2",
    JSON.stringify({
      version: 0,
      state: {
        ownerAccountId: 101,
        answers: { [assessmentId]: { q1: "q1-a" } },
        currentIndex: { [assessmentId]: 1 },
        attemptIds: { [assessmentId]: attemptId },
        shareCodes: { [assessmentId]: "as1.legacy-unbound" },
        assessmentVersions: { [assessmentId]: 1 },
        started: { [assessmentId]: true },
        readyToSubmit: {},
      },
    }),
  );

  await useQuizSession.persist.rehydrate();
  const state = useQuizSession.getState();

  assert.equal(state.getAttemptId(assessmentId, 1), attemptId);
  assert.deepEqual(state.getAnswers(assessmentId, 1), { q1: "q1-a" });
  assert.equal(state.getCurrentIndex(assessmentId, 1), 1);
  assert.equal(state.hasStarted(assessmentId, 1), true);
  assert.deepEqual(state.shareAttributions, {});
  assert.equal(
    state.getShareCode(assessmentId, 1, attemptId),
    undefined,
  );
});
