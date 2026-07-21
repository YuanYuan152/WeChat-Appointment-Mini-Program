"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useRequireAssessmentLogin } from "@/components/assessment/assessment-auth-gate";

interface StartAssessmentButtonProps {
  assessmentId: string;
  type: "professional" | "fun";
  questionCount?: number;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  children?: React.ReactNode;
  className?: string;
  /** 为 true 时清空进度后进入（用于「重新测试」） */
  reset?: boolean;
}

function resolveLabel(
  answeredCount: number,
  questionCount: number,
  reset: boolean,
  children: React.ReactNode
) {
  if (children !== "开始测评" || reset) return children;
  if (questionCount > 0 && answeredCount >= questionCount) return "再次测评";
  if (answeredCount > 0) return "继续测评";
  return "开始测评";
}

export function StartAssessmentButton({
  assessmentId,
  type,
  questionCount = 0,
  size = "sm",
  variant = "default",
  children = "开始测评",
  className,
  reset = false,
}: StartAssessmentButtonProps) {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const getAnsweredCount = useQuizSession((s) => s.getAnsweredCount);
  const requireLogin = useRequireAssessmentLogin();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    done();
    return useQuizSession.persist.onFinishHydration(done);
  }, []);

  const targetPath = `/assessment/${type}/${assessmentId}`;
  const answeredCount = hydrated ? getAnsweredCount(assessmentId) : 0;
  const completed = questionCount > 0 && answeredCount >= questionCount;
  const label = resolveLabel(answeredCount, questionCount, reset, children);

  const handleStart = () => {
    requireLogin(targetPath, () => {
      // 再次测评 / 显式 reset：清空后重开
      if (reset || completed) clearSession(assessmentId);
      router.push(targetPath);
    });
  };

  return (
    <Button size={size} variant={variant} className={className} onClick={handleStart}>
      {label}
    </Button>
  );
}

export function useBeginAssessment() {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const requireLogin = useRequireAssessmentLogin();

  return (assessmentId: string, type: "professional" | "fun", options?: { reset?: boolean }) => {
    const targetPath = `/assessment/${type}/${assessmentId}`;
    requireLogin(targetPath, () => {
      if (options?.reset !== false) {
        clearSession(assessmentId);
      }
      router.push(targetPath);
    });
  };
}
