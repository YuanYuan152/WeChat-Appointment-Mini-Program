"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  ASSESSMENT_PRIVACY_VERSION,
  isProfessionalAssessmentPrivacyAccepted,
} from "@/lib/assessment/privacy-content";
import { areRequiredAssessmentQuestionsAnswered } from "@/lib/assessment/assessment-progress";
import {
  areDemographicAnswersComplete,
  cleanDemographicAnswers,
} from "@/lib/assessment/demographic-answers";
import { submitAssessmentReport } from "@/lib/assessment/api";
import { DemographicForm } from "./demographic-form";
import { ReportView } from "./report-view";
import type { Assessment, AssessmentReportDetail } from "@/lib/api/types";

interface ResultClientProps {
  assessment: Assessment;
  type: "professional" | "fun";
}

function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function fallbackSubmissionId(userId: number, assessment: Assessment): string {
  const key = `assessment-submission:${userId}:${assessment.id}:v${assessment.version ?? 1}`;
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const created = createSubmissionId();
  localStorage.setItem(key, created);
  return created;
}

export function ResultClient({ assessment, type }: ResultClientProps) {
  const router = useRouter();
  const {
    getAnswers,
    getAttemptId,
    getShareCode,
    ensureAccount,
    isReadyToSubmit,
    setDemographicAnswer,
  } = useQuizSession();
  const version = assessment.version ?? 1;
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const [hydrated, setHydrated] = useState(false);
  // 进入结果页时人口学信息是否需要补填：齐全时直接生成报告；需要补填时填完由用户手动提交
  const [needsDemographicForm, setNeedsDemographicForm] = useState(false);
  const [report, setReport] = useState<AssessmentReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionStarted = useRef(false);
  const answers = useMemo(
    () => (hydrated ? getAnswers(assessment.id, version) : {}),
    [assessment.id, getAnswers, hydrated, version],
  );
  // 作答前填写的人口学信息（订阅存储，结果页补填时也能实时更新）
  const storedDemographics = useQuizSession((state) => state.demographicAnswers[assessment.id]);
  const demographicAnswers = useMemo(
    () => (hydrated ? storedDemographics ?? {} : {}),
    [hydrated, storedDemographics],
  );
  const validSession =
    hydrated && isReadyToSubmit(assessment.id, version);
  const demographicQuestions = useMemo(
    () => assessment.demographicQuestions ?? [],
    [assessment.demographicQuestions]
  );

  const requiredQuestionsAnswered =
    areRequiredAssessmentQuestionsAnswered(assessment.questions, answers);
  const demographicsComplete = areDemographicAnswersComplete(
    demographicQuestions,
    demographicAnswers,
  );

  useEffect(() => {
    localStorage.removeItem("assessment-reports");
  }, []);

  useEffect(() => {
    const sync = () => {
      if (userId == null) {
        return;
      }
      ensureAccount(userId);
      const stored = useQuizSession.getState().demographicAnswers[assessment.id];
      setNeedsDemographicForm(!areDemographicAnswersComplete(demographicQuestions, stored));
      setHydrated(true);
    };
    if (useQuizSession.persist.hasHydrated()) {
      sync();
    }
    return useQuizSession.persist.onFinishHydration(sync);
  }, [assessment.id, demographicQuestions, ensureAccount, userId]);

  useEffect(() => {
    if (hydrated && (!validSession || !requiredQuestionsAnswered)) {
      router.replace(`/assessment/${type}/${assessment.id}`);
    }
  }, [
    assessment.id,
    hydrated,
    requiredQuestionsAnswered,
    router,
    type,
    validSession,
  ]);

  const saveReport = useCallback(async () => {
    if (
      !validSession ||
      !requiredQuestionsAnswered ||
      !demographicsComplete ||
      !token ||
      userId == null ||
      submissionStarted.current
    ) {
      return;
    }
    if (
      type === "professional" &&
      !isProfessionalAssessmentPrivacyAccepted(userId)
    ) {
      setError("隐私保护协议已更新，请返回量表页阅读并同意后重新提交。");
      return;
    }

    submissionStarted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const clientSubmissionId =
        getAttemptId(assessment.id, version) ??
        fallbackSubmissionId(userId, assessment);
      const shareCode =
        getShareCode(assessment.id, version, clientSubmissionId) ?? null;
      const saved = await submitAssessmentReport(token, {
        clientSubmissionId,
        assessmentId: assessment.id,
        assessmentVersion: assessment.version ?? 1,
        demographicAnswers: cleanDemographicAnswers(demographicQuestions, demographicAnswers),
        answers,
        entrySource: shareCode ? "qr" : "web",
        shareCode,
        consentVersion:
          type === "professional" ? ASSESSMENT_PRIVACY_VERSION : "not-required",
      });
      setReport(saved);
    } catch (reason) {
      submissionStarted.current = false;
      setError(reason instanceof Error ? reason.message : "报告保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }, [
    requiredQuestionsAnswered,
    validSession,
    demographicsComplete,
    token,
    userId,
    type,
    getAttemptId,
    getShareCode,
    assessment,
    version,
    demographicQuestions,
    demographicAnswers,
    answers,
  ]);

  // 人口学信息已在作答前填好（或量表没有人口学题）时直接生成报告
  const autoSubmit = hydrated && !needsDemographicForm;
  useEffect(() => {
    if (autoSubmit) {
      const timer = window.setTimeout(() => void saveReport(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [autoSubmit, saveReport]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!validSession || !requiredQuestionsAnswered) return null;

  if (report) {
    const snapshotAssessment = report.reportSnapshot.assessment;
    const renderAssessment: Assessment = {
      ...snapshotAssessment,
      questionCount: snapshotAssessment.questions.length,
    };
    return (
      <ReportView
        assessment={renderAssessment}
        inviteAssessment={assessment}
        result={report.reportSnapshot.result}
        type={report.category}
      />
    );
  }

  if (needsDemographicForm) {
    // 一般在作答前已填写；升级前开始的作答等情况缺少时在这里补填
    return (
      <DemographicForm
        questions={demographicQuestions}
        values={demographicAnswers}
        title="补充基本信息"
        description="生成报告前还需要补充以下信息。"
        submitLabel={submitting ? "生成并保存中…" : "生成并保存报告"}
        submitting={submitting}
        error={error}
        onChange={(questionId, value) =>
          setDemographicAnswer(assessment.id, questionId, value)
        }
        onSubmit={() => void saveReport()}
      />
    );
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-6 py-14 text-center shadow-sm">
      {submitting ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">正在生成并同步报告…</p>
        </>
      ) : (
        <>
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-4 text-sm text-destructive">{error ?? "报告尚未生成"}</p>
          <Button className="mt-5" onClick={() => void saveReport()}>
            重试
          </Button>
        </>
      )}
    </div>
  );
}
