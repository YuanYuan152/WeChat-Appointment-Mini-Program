"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useRequireAssessmentLogin } from "@/components/assessment/assessment-auth-gate";

interface StartAssessmentButtonProps {
  assessmentId: string;
  type: "professional" | "fun";
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  children?: React.ReactNode;
  className?: string;
}

export function StartAssessmentButton({
  assessmentId,
  type,
  size = "sm",
  variant = "default",
  children = "开始测评",
  className,
}: StartAssessmentButtonProps) {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const requireLogin = useRequireAssessmentLogin();

  const targetPath = `/assessment/${type}/${assessmentId}`;

  const handleStart = () => {
    requireLogin(targetPath, () => {
      clearSession(assessmentId);
      router.push(targetPath);
    });
  };

  return (
    <Button size={size} variant={variant} className={className} onClick={handleStart}>
      {children}
    </Button>
  );
}

export function useBeginAssessment() {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const requireLogin = useRequireAssessmentLogin();

  return (assessmentId: string, type: "professional" | "fun") => {
    const targetPath = `/assessment/${type}/${assessmentId}`;
    requireLogin(targetPath, () => {
      clearSession(assessmentId);
      router.push(targetPath);
    });
  };
}
