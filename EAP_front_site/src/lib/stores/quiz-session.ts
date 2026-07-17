"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface QuizSessionState {
  answers: Record<string, Record<string, string>>;
  currentIndex: Record<string, number>;
  setAnswer: (assessmentId: string, questionId: string, optionId: string) => void;
  setCurrentIndex: (assessmentId: string, index: number) => void;
  getAnswers: (assessmentId: string) => Record<string, string>;
  getCurrentIndex: (assessmentId: string) => number;
  clearSession: (assessmentId: string) => void;
}

export const useQuizSession = create<QuizSessionState>()(
  persist(
    (set, get) => ({
      answers: {},
      currentIndex: {},

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

      getAnswers: (assessmentId) => get().answers[assessmentId] ?? {},

      getCurrentIndex: (assessmentId) => get().currentIndex[assessmentId] ?? 0,

      clearSession: (assessmentId) =>
        set((state) => {
          const { [assessmentId]: _a, ...answers } = state.answers;
          const { [assessmentId]: _i, ...currentIndex } = state.currentIndex;
          return { answers, currentIndex };
        }),
    }),
    {
      name: "quiz-session",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
