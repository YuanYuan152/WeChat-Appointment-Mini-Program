"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PrivacyAgreementDialog } from "./privacy-agreement-dialog";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
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
  assessmentVersion: number;
}

export function StartProfessionalAssessmentButton({
  assessmentId,
  assessmentVersion,
}: StartProfessionalAssessmentButtonProps) {
  const router = useRouter();
  const clearSession = useQuizSession((s) => s.clearSession);
  const getAnsweredCount = useQuizSession((s) => s.getAnsweredCount);
  const hasStarted = useQuizSession((s) => s.hasStarted);
  const isReadyToSubmit = useQuizSession((s) => s.isReadyToSubmit);
  const isAccountSessionOwner = useQuizSession(
    (s) => s.isAccountSessionOwner,
  );
  const userId = useAuthStore((state) => state.user?.id);
  const requireLogin = useRequireAssessmentLogin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    if (useQuizSession.persist.hasHydrated()) {
      done();
    }
    return useQuizSession.persist.onFinishHydration(done);
  }, []);

  const targetPath = `/assessment/professional/${assessmentId}`;
  const sessionOwned =
    hydrated &&
    userId != null &&
    isAccountSessionOwner(userId);
  const answeredCount = sessionOwned
    ? getAnsweredCount(assessmentId, assessmentVersion)
    : 0;
  const completed =
    sessionOwned && isReadyToSubmit(assessmentId, assessmentVersion);
  const inProgress =
    sessionOwned &&
    !completed &&
    (hasStarted(assessmentId, assessmentVersion) || answeredCount > 0);
  const label = completed ? "再次测评" : inProgress ? "继续测评" : "开始测评";

  const navigate = useCallback(() => {
    if (completed) clearSession(assessmentId, assessmentVersion);
    router.push(targetPath);
  }, [
    assessmentId,
    assessmentVersion,
    clearSession,
    completed,
    router,
    targetPath,
  ]);

  const handleStart = () => {
    requireLogin(targetPath, () => {
      const accountId = useAuthStore.getState().user?.id;
      if (accountId == null) {
        router.push(targetPath);
      } else if (isProfessionalAssessmentPrivacyAccepted(accountId)) {
        navigate();
      } else {
        setDialogOpen(true);
      }
    });
  };

  const handleAccept = () => {
    const accountId = useAuthStore.getState().user?.id;
    setDialogOpen(false);
    if (
      accountId != null &&
      acceptProfessionalAssessmentPrivacy(accountId)
    ) {
      navigate();
    } else {
      router.push(targetPath);
    }
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
  /** 进入页面时若未同意则自动弹出 */
  autoPrompt?: boolean;
}

export function ProfessionalAssessmentPrivacyGate({
  children,
  autoPrompt = true,
}: ProfessionalAssessmentPrivacyGateProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const [accepted, setAccepted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const ok = isProfessionalAssessmentPrivacyAccepted(userId);
    // localStorage is only available after hydration; this effect synchronizes
    // the persisted consent state with the client-only gate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccepted(ok);
    if (!ok && autoPrompt) {
      setDialogOpen(true);
    }
    setHydrated(true);
  }, [autoPrompt, userId]);

  const handleAccept = () => {
    if (acceptProfessionalAssessmentPrivacy(userId)) {
      setAccepted(true);
      setDialogOpen(false);
    }
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
