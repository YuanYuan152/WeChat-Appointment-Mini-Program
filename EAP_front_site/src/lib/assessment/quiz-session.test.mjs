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

  useQuizSession.getState().ensureVersion(assessmentId, 2);
  state = useQuizSession.getState();

  assert.deepEqual(state.getAnswers(assessmentId, 2), {});
  assert.equal(state.hasStarted(assessmentId, 2), false);
  assert.equal(state.isReadyToSubmit(assessmentId, 2), false);
  assert.notEqual(state.getAttemptId(assessmentId, 2), firstAttemptId);
  assert.equal(state.getAttemptId(assessmentId, 1), undefined);
});

test("switching accounts clears persisted answers and submission state", () => {
  const assessmentId = "account-change-test";
  let state = useQuizSession.getState();

  state.ensureAccount(101);
  state.ensureVersion(assessmentId, 1);
  state.markStarted(assessmentId);
  state.setAnswer(assessmentId, "q1", "q1-a");
  state.markReadyToSubmit(assessmentId, 1);

  assert.equal(state.isAccountSessionOwner(101), true);
  assert.equal(state.getAnsweredCount(assessmentId, 1), 1);
  assert.equal(state.isReadyToSubmit(assessmentId, 1), true);

  state.ensureAccount(202);
  state = useQuizSession.getState();

  assert.equal(state.isAccountSessionOwner(101), false);
  assert.equal(state.isAccountSessionOwner(202), true);
  assert.deepEqual(state.getAnswers(assessmentId, 1), {});
  assert.equal(state.getAttemptId(assessmentId, 1), undefined);
  assert.equal(state.hasStarted(assessmentId, 1), false);
  assert.equal(state.isReadyToSubmit(assessmentId, 1), false);
});
