"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getResultSummary } from "@/lib/assessment/report-summary";
import { useAuthStore } from "@/lib/stores/auth-store";
import type {
  Assessment,
  AssessmentReportRecord,
  AssessmentScoreResult,
} from "@/lib/api/types";

interface AddReportInput {
  assessment: Assessment;
  type: "professional" | "fun";
  result: AssessmentScoreResult;
}

interface AssessmentReportsState {
  byUser: Record<string, AssessmentReportRecord[]>;
  addReport: (userId: number, input: AddReportInput) => string;
  getReportsForUser: (userId: number) => AssessmentReportRecord[];
  getReport: (userId: number, id: string) => AssessmentReportRecord | undefined;
  removeReport: (userId: number, id: string) => void;
}

type LegacyPersisted = { reports?: AssessmentReportRecord[] };

const EMPTY_REPORTS: AssessmentReportRecord[] = [];

export const useAssessmentReports = create<AssessmentReportsState>()(
  persist(
    (set, get) => ({
      byUser: {},

      addReport: (userId, { assessment, type, result }) => {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const record: AssessmentReportRecord = {
          id,
          userId,
          assessmentId: assessment.id,
          type,
          assessmentTitle: assessment.title,
          assessmentSubtitle: assessment.subtitle,
          cover: assessment.cover,
          disclaimer: assessment.disclaimer,
          scoringType: assessment.scoringType,
          completedAt: new Date().toISOString(),
          resultSummary: getResultSummary(result),
          result,
        };

        const key = String(userId);
        set((state) => ({
          byUser: {
            ...state.byUser,
            [key]: [record, ...(state.byUser[key] ?? [])],
          },
        }));

        return id;
      },

      getReportsForUser: (userId) => get().byUser[String(userId)] ?? EMPTY_REPORTS,

      getReport: (userId, id) =>
        get().byUser[String(userId)]?.find((r) => r.id === id),

      removeReport: (userId, id) => {
        const key = String(userId);
        set((state) => ({
          byUser: {
            ...state.byUser,
            [key]: (state.byUser[key] ?? []).filter((r) => r.id !== id),
          },
        }));
      },
    }),
    {
      name: "assessment-reports",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const state = persisted as LegacyPersisted & {
          byUser?: Record<string, AssessmentReportRecord[]>;
        };
        if (state.byUser) return { byUser: state.byUser };
        return { byUser: {} };
      },
    }
  )
);

export function useCurrentUserReports() {
  const userId = useAuthStore((s) => s.user?.id);
  return useAssessmentReports((s) => {
    if (userId == null) return EMPTY_REPORTS;
    return s.byUser[String(userId)] ?? EMPTY_REPORTS;
  });
}
