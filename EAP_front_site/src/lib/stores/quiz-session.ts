"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface QuizShareAttribution {
  shareCode: string;
  assessmentVersion: number;
  attemptId: string;
}

interface QuizSessionState {
  ownerAccountId: number | null;
  answers: Record<string, Record<string, string>>;
  currentIndex: Record<string, number>;
  attemptIds: Record<string, string>;
  shareAttributions: Record<string, QuizShareAttribution>;
  assessmentVersions: Record<string, number>;
  /** 用户是否已确认进入答题（看过指导语） */
  started: Record<string, boolean>;
  /** 用户已完成当前作答流程，可进入报告页。 */
  readyToSubmit: Record<string, boolean>;
  setAnswer: (assessmentId: string, questionId: string, optionId: string) => void;
  setCurrentIndex: (assessmentId: string, index: number) => void;
  markStarted: (assessmentId: string) => void;
  markReadyToSubmit: (assessmentId: string, version: number) => void;
  ensureAccount: (accountId: number) => void;
  ensureVersion: (assessmentId: string, version: number) => void;
  isAccountSessionOwner: (accountId: number) => boolean;
  getAnswers: (assessmentId: string, version?: number) => Record<string, string>;
  getCurrentIndex: (assessmentId: string, version?: number) => number;
  getAttemptId: (assessmentId: string, version?: number) => string | undefined;
  setShareCode: (
    assessmentId: string,
    version: number,
    attemptId: string,
    shareCode: string
  ) => void;
  getShareCode: (
    assessmentId: string,
    version: number,
    attemptId: string
  ) => string | undefined;
  hasStarted: (assessmentId: string, version?: number) => boolean;
  isReadyToSubmit: (assessmentId: string, version: number) => boolean;
  getAnsweredCount: (assessmentId: string, version?: number) => number;
  clearSession: (assessmentId: string, version?: number) => void;
  clearAllSessions: () => void;
}

function createAttemptId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function migrateQuizSessionState(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== "object") {
    return { shareAttributions: {} };
  }
  const compatibleState = {
    ...(persistedState as Record<string, unknown>),
  };
  // Legacy shareCodes had no account/version/attempt binding. Keeping those
  // values would allow an unrelated later attempt to inherit attribution.
  delete compatibleState.shareCodes;
  delete compatibleState.shareAttributions;
  return {
    ...compatibleState,
    // Old persisted attribution must fail closed. Only records written by the
    // current bound format can be trusted after this migration.
    shareAttributions: {},
  };
}

export const useQuizSession = create<QuizSessionState>()(
  persist(
    (set, get) => ({
      ownerAccountId: null,
      answers: {},
      currentIndex: {},
      attemptIds: {},
      shareAttributions: {},
      assessmentVersions: {},
      started: {},
      readyToSubmit: {},

      setAnswer: (assessmentId, questionId, optionId) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [assessmentId]: {
              ...state.answers[assessmentId],
              [questionId]: optionId,
            },
          },
        })),

      setCurrentIndex: (assessmentId, index) =>
        set((state) => ({
          currentIndex: { ...state.currentIndex, [assessmentId]: index },
        })),

      markStarted: (assessmentId) =>
        set((state) => ({
          started: { ...state.started, [assessmentId]: true },
        })),

      markReadyToSubmit: (assessmentId, version) =>
        set((state) => {
          if (
            state.assessmentVersions[assessmentId] !== version ||
            !state.started[assessmentId]
          ) {
            return state;
          }
          return {
            readyToSubmit: {
              ...state.readyToSubmit,
              [assessmentId]: true,
            },
          };
        }),

      ensureAccount: (accountId) =>
        set((state) => {
          if (state.ownerAccountId === accountId) {
            return state;
          }
          return {
            ownerAccountId: accountId,
            answers: {},
            currentIndex: {},
            attemptIds: {},
            shareAttributions: {},
            assessmentVersions: {},
            started: {},
            readyToSubmit: {},
          };
        }),

      ensureVersion: (assessmentId, version) =>
        set((state) => {
          if (state.assessmentVersions[assessmentId] === version) {
            return state;
          }
          const answers = { ...state.answers };
          const currentIndex = { ...state.currentIndex };
          const started = { ...state.started };
          const readyToSubmit = { ...state.readyToSubmit };
          const shareAttributions = { ...state.shareAttributions };
          delete answers[assessmentId];
          delete currentIndex[assessmentId];
          delete started[assessmentId];
          delete readyToSubmit[assessmentId];
          delete shareAttributions[assessmentId];
          return {
            answers,
            currentIndex,
            started,
            readyToSubmit,
            shareAttributions,
            assessmentVersions: {
              ...state.assessmentVersions,
              [assessmentId]: version,
            },
            attemptIds: {
              ...state.attemptIds,
              [assessmentId]: createAttemptId(),
            },
          };
        }),

      getAnswers: (assessmentId, version) => {
        if (
          version !== undefined &&
          get().assessmentVersions[assessmentId] !== version
        ) {
          return {};
        }
        return get().answers[assessmentId] ?? {};
      },

      getCurrentIndex: (assessmentId, version) => {
        if (
          version !== undefined &&
          get().assessmentVersions[assessmentId] !== version
        ) {
          return 0;
        }
        return get().currentIndex[assessmentId] ?? 0;
      },

      getAttemptId: (assessmentId, version) => {
        if (
          version !== undefined &&
          get().assessmentVersions[assessmentId] !== version
        ) {
          return undefined;
        }
        return get().attemptIds[assessmentId];
      },

      setShareCode: (assessmentId, version, attemptId, shareCode) =>
        set((state) => {
          const normalizedShareCode = shareCode.trim();
          if (
            !normalizedShareCode ||
            state.assessmentVersions[assessmentId] !== version ||
            state.attemptIds[assessmentId] !== attemptId
          ) {
            return state;
          }
          return {
            shareAttributions: {
              ...state.shareAttributions,
              [assessmentId]: {
                shareCode: normalizedShareCode,
                assessmentVersion: version,
                attemptId,
              },
            },
          };
        }),

      getShareCode: (assessmentId, version, attemptId) => {
        const state = get();
        const attribution = state.shareAttributions[assessmentId];
        if (
          state.assessmentVersions[assessmentId] !== version ||
          state.attemptIds[assessmentId] !== attemptId ||
          attribution?.assessmentVersion !== version ||
          attribution.attemptId !== attemptId
        ) {
          return undefined;
        }
        return attribution.shareCode;
      },

      isAccountSessionOwner: (accountId) =>
        get().ownerAccountId === accountId,

      hasStarted: (assessmentId, version) =>
        (version === undefined ||
          get().assessmentVersions[assessmentId] === version) &&
        Boolean(get().started[assessmentId]),

      isReadyToSubmit: (assessmentId, version) =>
        get().assessmentVersions[assessmentId] === version &&
        Boolean(get().started[assessmentId]) &&
        Boolean(get().readyToSubmit[assessmentId]),

      getAnsweredCount: (assessmentId, version) => {
        if (
          version !== undefined &&
          get().assessmentVersions[assessmentId] !== version
        ) {
          return 0;
        }
        return Object.keys(get().answers[assessmentId] ?? {}).length;
      },

      clearSession: (assessmentId, version) =>
        set((state) => {
          const answers = { ...state.answers };
          const currentIndex = { ...state.currentIndex };
          const started = { ...state.started };
          const readyToSubmit = { ...state.readyToSubmit };
          const assessmentVersions = { ...state.assessmentVersions };
          const shareAttributions = { ...state.shareAttributions };
          delete answers[assessmentId];
          delete currentIndex[assessmentId];
          delete started[assessmentId];
          delete readyToSubmit[assessmentId];
          delete shareAttributions[assessmentId];
          if (version === undefined) {
            delete assessmentVersions[assessmentId];
          } else {
            assessmentVersions[assessmentId] = version;
          }
          return {
            answers,
            currentIndex,
            started,
            readyToSubmit,
            shareAttributions,
            assessmentVersions,
            attemptIds: {
              ...state.attemptIds,
              [assessmentId]: createAttemptId(),
            },
          };
        }),

      clearAllSessions: () =>
        set({
          ownerAccountId: null,
          answers: {},
          currentIndex: {},
          attemptIds: {},
          shareAttributions: {},
          assessmentVersions: {},
          started: {},
          readyToSubmit: {},
        }),
    }),
    {
      name: "quiz-session-v2",
      version: 1,
      migrate: migrateQuizSessionState,
      // 使用 localStorage，关闭标签后仍可续做
      storage: createJSONStorage(() => localStorage),
    }
  )
);
