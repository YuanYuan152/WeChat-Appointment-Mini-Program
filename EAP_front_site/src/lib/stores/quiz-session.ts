"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface QuizSessionState {
  answers: Record<string, Record<string, string>>;
  currentIndex: Record<string, number>;
  attemptIds: Record<string, string>;
  shareCodes: Record<string, string>;
  /** 用户是否已确认进入答题（看过指导语） */
  started: Record<string, boolean>;
  setAnswer: (assessmentId: string, questionId: string, optionId: string) => void;
  setCurrentIndex: (assessmentId: string, index: number) => void;
  markStarted: (assessmentId: string) => void;
  getAnswers: (assessmentId: string) => Record<string, string>;
  getCurrentIndex: (assessmentId: string) => number;
  getAttemptId: (assessmentId: string) => string | undefined;
  setShareCode: (assessmentId: string, shareCode: string | null) => void;
  getShareCode: (assessmentId: string) => string | undefined;
  hasStarted: (assessmentId: string) => boolean;
  /** 是否有未完成的作答进度 */
  hasInProgress: (assessmentId: string, questionCount: number) => boolean;
  getAnsweredCount: (assessmentId: string) => number;
  /** 是否已答完全部题目 */
  isComplete: (assessmentId: string, questionCount: number) => boolean;
  clearSession: (assessmentId: string) => void;
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

export const useQuizSession = create<QuizSessionState>()(
  persist(
    (set, get) => ({
      answers: {},
      currentIndex: {},
      attemptIds: {},
      shareCodes: {},
      started: {},

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

      getAnswers: (assessmentId) => get().answers[assessmentId] ?? {},

      getCurrentIndex: (assessmentId) => get().currentIndex[assessmentId] ?? 0,

      getAttemptId: (assessmentId) => get().attemptIds[assessmentId],

      setShareCode: (assessmentId, shareCode) =>
        set((state) => {
          const shareCodes = { ...state.shareCodes };
          if (shareCode) {
            shareCodes[assessmentId] = shareCode;
          } else {
            delete shareCodes[assessmentId];
          }
          return { shareCodes };
        }),

      getShareCode: (assessmentId) => get().shareCodes[assessmentId],

      hasStarted: (assessmentId) => Boolean(get().started[assessmentId]),

      getAnsweredCount: (assessmentId) =>
        Object.keys(get().answers[assessmentId] ?? {}).length,

      hasInProgress: (assessmentId, questionCount) => {
        const answers = get().answers[assessmentId] ?? {};
        const count = Object.keys(answers).length;
        return count > 0 && count < questionCount;
      },

      isComplete: (assessmentId, questionCount) => {
        if (questionCount <= 0) return false;
        return Object.keys(get().answers[assessmentId] ?? {}).length >= questionCount;
      },

      clearSession: (assessmentId) =>
        set((state) => {
          const answers = { ...state.answers };
          const currentIndex = { ...state.currentIndex };
          const started = { ...state.started };
          delete answers[assessmentId];
          delete currentIndex[assessmentId];
          delete started[assessmentId];
          return {
            answers,
            currentIndex,
            started,
            attemptIds: {
              ...state.attemptIds,
              [assessmentId]: createAttemptId(),
            },
          };
        }),
    }),
    {
      name: "quiz-session-v2",
      // 使用 localStorage，关闭标签后仍可续做
      storage: createJSONStorage(() => localStorage),
    }
  )
);
