"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AssessmentAnswerValue } from "@/lib/api/types";

interface QuizShareAttribution {
  shareCode: string;
  assessmentVersion: number;
  attemptId: string;
}

interface QuizSessionState {
  ownerAccountId: number | null;
  answers: Record<string, Record<string, AssessmentAnswerValue>>;
  /**
   * 作答前填写的人口学信息（按量表）。重新开始作答时保留，作为下一次的预填；
   * 切换账号、量表版本变化或退出登录时清空。
   */
  demographicAnswers: Record<string, Record<string, unknown>>;
  currentIndex: Record<string, number>;
  attemptIds: Record<string, string>;
  shareAttributions: Record<string, QuizShareAttribution>;
  assessmentVersions: Record<string, number>;
  /** 用户是否已确认进入答题（看过指导语） */
  started: Record<string, boolean>;
  /** 用户已完成当前作答流程，可进入报告页。 */
  readyToSubmit: Record<string, boolean>;
  setAnswer: (
    assessmentId: string,
    questionId: string,
    value: AssessmentAnswerValue | undefined,
  ) => void;
  setDemographicAnswer: (assessmentId: string, questionId: string, value: unknown) => void;
  getDemographicAnswers: (
    assessmentId: string,
    version?: number,
  ) => Record<string, unknown>;
  setCurrentIndex: (assessmentId: string, index: number) => void;
  markStarted: (assessmentId: string) => void;
  markReadyToSubmit: (assessmentId: string, version: number) => void;
  ensureAccount: (accountId: number) => void;
  ensureVersion: (assessmentId: string, version: number) => void;
  isAccountSessionOwner: (accountId: number) => boolean;
  getAnswers: (
    assessmentId: string,
    version?: number,
  ) => Record<string, AssessmentAnswerValue>;
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

/** 未填写时返回同一个空对象，避免组件每次渲染拿到新对象。 */
const EMPTY_DEMOGRAPHIC_ANSWERS: Record<string, unknown> = Object.freeze({});

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
      demographicAnswers: {},
      currentIndex: {},
      attemptIds: {},
      shareAttributions: {},
      assessmentVersions: {},
      started: {},
      readyToSubmit: {},

      setAnswer: (assessmentId, questionId, value) =>
        set((state) => {
          const current = { ...(state.answers[assessmentId] ?? {}) };
          if (value === undefined) {
            delete current[questionId];
          } else {
            current[questionId] = value;
          }
          return {
            answers: {
              ...state.answers,
              [assessmentId]: current,
            },
          };
        }),

      setDemographicAnswer: (assessmentId, questionId, value) =>
        set((state) => {
          const current = { ...(state.demographicAnswers[assessmentId] ?? {}) };
          const empty =
            value == null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0);
          if (empty) {
            delete current[questionId];
          } else {
            current[questionId] = value;
          }
          return {
            demographicAnswers: {
              ...state.demographicAnswers,
              [assessmentId]: current,
            },
          };
        }),

      getDemographicAnswers: (assessmentId, version) => {
        if (
          version !== undefined &&
          get().assessmentVersions[assessmentId] !== version
        ) {
          return EMPTY_DEMOGRAPHIC_ANSWERS;
        }
        return get().demographicAnswers[assessmentId] ?? EMPTY_DEMOGRAPHIC_ANSWERS;
      },

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
            demographicAnswers: {},
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
          const demographicAnswers = { ...state.demographicAnswers };
          const currentIndex = { ...state.currentIndex };
          const started = { ...state.started };
          const readyToSubmit = { ...state.readyToSubmit };
          const shareAttributions = { ...state.shareAttributions };
          delete answers[assessmentId];
          // 新版本的人口学题可能变了，不沿用旧版本填写的内容
          delete demographicAnswers[assessmentId];
          delete currentIndex[assessmentId];
          delete started[assessmentId];
          delete readyToSubmit[assessmentId];
          delete shareAttributions[assessmentId];
          return {
            answers,
            demographicAnswers,
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
          demographicAnswers: {},
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
