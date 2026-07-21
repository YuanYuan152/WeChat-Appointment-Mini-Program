"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PrivacyAgreementDialog } from "./privacy-agreement-dialog";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useRequireAssessmentLogin } from "@/components/assessment/assessment-auth-gate";
import {
  acceptProfessionalAssessmentPrivacy,
  isProfessionalAssessmentPrivacyAccepted,
} from "@/lib/assessment/privacy-content";

export function ProfessionalAssessmentEntry() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/assessment/professional")}
      className="group w-full text-left"
    >
      <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <ClipboardList className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-serif text-xl font-semibold group-hover:text-primary">
          专业测评
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          基于国际认可的心理量表（PHQ-9、GAD-7），评估抑郁与焦虑状况，获取专业解读报告。
        </p>
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "mt-6 pointer-events-none"
          )}
        >
          进入专业测评
        </span>
      </div>
    </button>
  );
}

interface StartProfessionalAssessmentButtonProps {
  assessmentId: string;
  questionCount?: number;
}

export function StartProfessionalAssessmentButton({
  assessmentId,
  questionCount = 0,
}: StartProfessionalAssessmentButtonProps) {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const getAnsweredCount = useQuizSession((s) => s.getAnsweredCount);
  const requireLogin = useRequireAssessmentLogin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    done();
    return useQuizSession.persist.onFinishHydration(done);
  }, []);

  const targetPath = `/assessment/professional/${assessmentId}`;
  const answeredCount = hydrated ? getAnsweredCount(assessmentId) : 0;
  const completed = questionCount > 0 && answeredCount >= questionCount;
  const inProgress = answeredCount > 0 && !completed;
  const label = completed ? "再次测评" : inProgress ? "继续测评" : "开始测评";

  const navigate = useCallback(() => {
    if (completed) clearSession(assessmentId);
    router.push(targetPath);
  }, [assessmentId, clearSession, completed, router, targetPath]);

  const handleStart = () => {
    requireLogin(targetPath, () => {
      if (isProfessionalAssessmentPrivacyAccepted(assessmentId)) {
        navigate();
      } else {
        setDialogOpen(true);
      }
    });
  };

  const handleAccept = () => {
    acceptProfessionalAssessmentPrivacy(assessmentId);
    setDialogOpen(false);
    navigate();
  };

  return (
    <>
      <Button size="sm" onClick={handleStart}>
        {label}
      </Button>
      <PrivacyAgreementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAccept={handleAccept}
        onDecline={() => setDialogOpen(false)}
      />
    </>
  );
}

interface ProfessionalAssessmentPrivacyGateProps {
  children: React.ReactNode;
  assessmentId: string;
  /** 进入页面时若未同意则自动弹出 */
  autoPrompt?: boolean;
}

export function ProfessionalAssessmentPrivacyGate({
  children,
  assessmentId,
  autoPrompt = true,
}: ProfessionalAssessmentPrivacyGateProps) {
  const [accepted, setAccepted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const ok = isProfessionalAssessmentPrivacyAccepted(assessmentId);
    setAccepted(ok);
    if (!ok && autoPrompt) {
      setDialogOpen(true);
    }
    setHydrated(true);
  }, [assessmentId, autoPrompt]);

  const handleAccept = () => {
    acceptProfessionalAssessmentPrivacy(assessmentId);
    setAccepted(true);
    setDialogOpen(false);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <>
      {accepted ? (
        children
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            开始专业测评前，请先阅读并同意《隐私保护协议》
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            阅读隐私保护协议
          </Button>
        </div>
      )}
      <PrivacyAgreementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAccept={handleAccept}
        onDecline={() => setDialogOpen(false)}
      />
    </>
  );
}
