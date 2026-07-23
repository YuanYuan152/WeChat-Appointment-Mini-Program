"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  ASSESSMENT_PRIVACY_VERSION,
  isProfessionalAssessmentPrivacyAccepted,
} from "@/lib/assessment/privacy-content";
import { submitAssessmentReport } from "@/lib/assessment/api";
import { ReportView } from "./report-view";
import type {
  Assessment,
  AssessmentReportDetail,
  DemographicQuestion,
  DemographicValue,
} from "@/lib/api/types";

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

function isEmptyDemographicValue(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function scalarEquals(left: unknown, right: DemographicValue): boolean {
  return typeof left === typeof right && left === right;
}

function DemographicField({
  question,
  value,
  onChange,
}: {
  question: DemographicQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const commonLabel = (
    <div className="mb-2">
      <label className="text-sm font-medium text-foreground" htmlFor={`demographic-${question.id}`}>
        {question.text}
        {question.required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {question.helpText ? (
        <p className="mt-1 text-xs text-muted-foreground">{question.helpText}</p>
      ) : null}
    </div>
  );

  if (question.inputType === "single") {
    const selected = question.options?.find((option) => scalarEquals(value, option.value));
    return (
      <div>
        {commonLabel}
        <select
          id={`demographic-${question.id}`}
          value={selected?.id ?? ""}
          onChange={(event) => {
            const option = question.options?.find((item) => item.id === event.target.value);
            onChange(option ? option.value : "");
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          required={question.required}
        >
          <option value="">请选择</option>
          {question.options?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.text}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.inputType === "multiple") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        {commonLabel}
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options?.map((option) => {
            const checked = selected.some((item) => scalarEquals(item, option.value));
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((item) => !scalarEquals(item, option.value))
                        : [...selected, option.value]
                    )
                  }
                />
                {option.text}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const stringValue = value == null ? "" : String(value);
  const inputType = question.inputType === "number" ? "number" : question.inputType;
  return (
    <div>
      {commonLabel}
      <Input
        id={`demographic-${question.id}`}
        type={inputType}
        value={stringValue}
        required={question.required}
        min={question.validation?.min}
        max={question.validation?.max}
        minLength={question.validation?.minLength}
        maxLength={question.validation?.maxLength}
        pattern={question.validation?.pattern}
        onChange={(event) => {
          if (question.inputType === "number") {
            onChange(event.target.value === "" ? "" : Number(event.target.value));
          } else {
            onChange(event.target.value);
          }
        }}
      />
    </div>
  );
}

export function ResultClient({ assessment, type }: ResultClientProps) {
  const router = useRouter();
  const { getAnswers, getAttemptId } = useQuizSession();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const [demographicAnswers, setDemographicAnswers] = useState<Record<string, unknown>>({});
  const [report, setReport] = useState<AssessmentReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionStarted = useRef(false);
  const answers = getAnswers(assessment.id);
  const demographicQuestions = useMemo(
    () => assessment.demographicQuestions ?? [],
    [assessment.demographicQuestions]
  );

  const allAnswered = assessment.questions.every((question) => answers[question.id]);
  const demographicsComplete = demographicQuestions.every(
    (question) => !question.required || !isEmptyDemographicValue(demographicAnswers[question.id])
  );

  useEffect(() => {
    localStorage.removeItem("assessment-reports");
  }, []);

  useEffect(() => {
    if (!allAnswered) {
      router.replace(`/assessment/${type}/${assessment.id}`);
    }
  }, [allAnswered, assessment.id, type, router]);

  const saveReport = useCallback(async () => {
    if (
      !allAnswered ||
      !demographicsComplete ||
      !token ||
      userId == null ||
      submissionStarted.current
    ) {
      return;
    }
    if (type === "professional" && !isProfessionalAssessmentPrivacyAccepted()) {
      setError("隐私保护协议已更新，请返回量表页阅读并同意后重新提交。");
      return;
    }

    submissionStarted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const clientSubmissionId =
        getAttemptId(assessment.id) ?? fallbackSubmissionId(userId, assessment);
      const saved = await submitAssessmentReport(token, {
        clientSubmissionId,
        assessmentId: assessment.id,
        assessmentVersion: assessment.version ?? 1,
        demographicAnswers,
        answers,
        entrySource: "web",
        shareCode: null,
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
    allAnswered,
    demographicsComplete,
    token,
    userId,
    type,
    getAttemptId,
    assessment,
    demographicAnswers,
    answers,
  ]);

  useEffect(() => {
    if (demographicQuestions.length === 0) {
      const timer = window.setTimeout(() => void saveReport(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [demographicQuestions.length, saveReport]);

  if (!allAnswered) return null;

  if (report) {
    const snapshotAssessment = report.reportSnapshot.assessment;
    const renderAssessment: Assessment = {
      ...snapshotAssessment,
      questionCount: snapshotAssessment.questions.length,
    };
    return (
      <ReportView
        assessment={renderAssessment}
        result={report.reportSnapshot.result}
        type={report.category}
      />
    );
  }

  if (demographicQuestions.length > 0) {
    return (
      <form
        className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void saveReport();
        }}
      >
        <h2 className="font-serif text-xl font-semibold">补充基本信息</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          以下信息用于完善本次报告，不参与量表计分。
        </p>
        <div className="mt-6 space-y-5">
          {demographicQuestions.map((question) => (
            <DemographicField
              key={question.id}
              question={question}
              value={demographicAnswers[question.id]}
              onChange={(value) =>
                setDemographicAnswers((current) => ({ ...current, [question.id]: value }))
              }
            />
          ))}
        </div>
        {error ? (
          <div className="mt-5 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}
        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={!demographicsComplete || submitting}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitting ? "生成并保存中…" : "生成并保存报告"}
        </Button>
      </form>
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
