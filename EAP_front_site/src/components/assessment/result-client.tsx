"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAssessmentReports } from "@/lib/stores/assessment-reports";
import { calculateScore } from "@/lib/assessment/engine";
import { ReportView } from "./report-view";
import type { Assessment } from "@/lib/api/types";

interface ResultClientProps {
  assessment: Assessment;
  type: "professional" | "fun";
}

export function ResultClient({ assessment, type }: ResultClientProps) {
  const router = useRouter();
  const { getAnswers } = useQuizSession();
  const userId = useAuthStore((s) => s.user?.id);
  const addReport = useAssessmentReports((s) => s.addReport);
  const savedRef = useRef(false);
  const answers = getAnswers(assessment.id);

  const allAnswered = assessment.questions.every((q) => answers[q.id]);

  useEffect(() => {
    if (!allAnswered) {
      router.replace(`/assessment/${type}/${assessment.id}`);
    }
  }, [allAnswered, assessment.id, type, router]);

  useEffect(() => {
    if (!allAnswered || savedRef.current || userId == null) return;

    const answerKey = Object.entries(answers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([q, o]) => `${q}:${o}`)
      .join("|");
    const saveKey = `assessment-report-saved:${userId}:${assessment.id}:${answerKey}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(saveKey)) {
      savedRef.current = true;
      return;
    }

    savedRef.current = true;
    const result = calculateScore(assessment, answers);
    addReport(userId, { assessment, type, result });
    sessionStorage.setItem(saveKey, "1");
  }, [allAnswered, assessment, answers, type, addReport, userId]);

  if (!allAnswered) return null;

  const result = calculateScore(assessment, answers);

  return <ReportView assessment={assessment} result={result} type={type} />;
}
