"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { QuizProgress } from "./quiz-progress";
import { QuestionCard } from "./question-card";
import { QuizIntro } from "./quiz-intro";
import { Button } from "@/components/ui/button";
import {
  areRequiredAssessmentQuestionsAnswered,
  findAssessmentResumeQuestionIndex,
  isRequiredAssessmentQuestion,
  shouldCreateFreshAssessmentAttempt,
} from "@/lib/assessment/assessment-progress";
import type { Assessment } from "@/lib/api/types";

interface QuizClientProps {
  assessment: Assessment;
  type: "professional" | "fun";
}

export function QuizClient({ assessment, type }: QuizClientProps) {
  const router = useRouter();
  const {
    getAnswers,
    getCurrentIndex,
    setAnswer,
    setCurrentIndex,
    clearSession,
    ensureAccount,
    ensureVersion,
    markStarted,
    markReadyToSubmit,
    hasStarted,
    getAnsweredCount,
    isReadyToSubmit,
  } = useQuizSession();
  const userId = useAuthStore((state) => state.user?.id);
  const version = assessment.version ?? 1;

  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<"intro" | "quiz">("intro");
  const advancingRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      if (userId == null) {
        return;
      }
      ensureAccount(userId);
      ensureVersion(assessment.id, version);
      setHydrated(true);
    };
    if (useQuizSession.persist.hasHydrated()) {
      sync();
    }
    return useQuizSession.persist.onFinishHydration(sync);
  }, [assessment.id, ensureAccount, ensureVersion, userId, version]);

  const answers = getAnswers(assessment.id, version);
  const currentIndex = getCurrentIndex(assessment.id, version);
  const question = assessment.questions[currentIndex];
  const selectedOption = question ? answers[question.id] : undefined;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === assessment.questions.length - 1;
  const canResume =
    hasStarted(assessment.id, version) &&
    !isReadyToSubmit(assessment.id, version);
  const isComplete = isReadyToSubmit(assessment.id, version);
  const answeredCount = getAnsweredCount(assessment.id, version);

  const goResult = () => {
    router.push(`/assessment/${type}/${assessment.id}/result`);
  };

  const handleStartFresh = () => {
    if (
      shouldCreateFreshAssessmentAttempt({
        started: hasStarted(assessment.id, version),
        answeredCount,
        completed: isComplete,
      })
    ) {
      clearSession(assessment.id, version);
    }
    markStarted(assessment.id);
    setCurrentIndex(assessment.id, 0);
    setPhase("quiz");
  };

  const handleResume = () => {
    const resumeIdx = findAssessmentResumeQuestionIndex(
      assessment.questions,
      getAnswers(assessment.id, version),
      getCurrentIndex(assessment.id, version),
    );
    markStarted(assessment.id);
    setCurrentIndex(assessment.id, resumeIdx);
    setPhase("quiz");
  };

  const handleSelect = (optionId: string) => {
    if (!question || advancingRef.current) return;
    setAnswer(assessment.id, question.id, optionId);

    // 点选后自动进入下一题；最后一题进入结果页
    advancingRef.current = true;
    window.setTimeout(() => {
      if (isLast) {
        const nextAnswers = {
          ...answers,
          [question.id]: optionId,
        };
        if (
          areRequiredAssessmentQuestionsAnswered(
            assessment.questions,
            nextAnswers,
          )
        ) {
          markReadyToSubmit(assessment.id, version);
          goResult();
        } else {
          setCurrentIndex(
            assessment.id,
            findAssessmentResumeQuestionIndex(
              assessment.questions,
              nextAnswers,
              currentIndex,
            ),
          );
        }
      } else {
        setCurrentIndex(assessment.id, currentIndex + 1);
      }
      advancingRef.current = false;
    }, 220);
  };

  const handlePrev = () => {
    if (isFirst || advancingRef.current) return;
    setCurrentIndex(assessment.id, currentIndex - 1);
  };

  const handleSkip = () => {
    if (
      !question ||
      isRequiredAssessmentQuestion(question) ||
      advancingRef.current
    ) {
      return;
    }
    if (isLast) {
      if (
        areRequiredAssessmentQuestionsAnswered(
          assessment.questions,
          answers,
        )
      ) {
        markReadyToSubmit(assessment.id, version);
        goResult();
      }
    } else {
      setCurrentIndex(assessment.id, currentIndex + 1);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <QuizIntro
        assessment={assessment}
        answeredCount={answeredCount}
        canResume={canResume}
        isComplete={isComplete}
        onStartFresh={handleStartFresh}
        onResume={handleResume}
        onViewResult={goResult}
      />
    );
  }

  if (!question) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        题目加载异常，请重新开始测评。
        <div className="mt-4">
          <Button onClick={handleStartFresh}>重新开始</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <QuizProgress current={currentIndex} total={assessment.questions.length} />
      <QuestionCard
        question={question}
        selectedOptionId={selectedOption}
        onSelect={handleSelect}
        index={currentIndex}
      />
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={handlePrev} disabled={isFirst}>
          上一题
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {isRequiredAssessmentQuestion(question)
            ? "点选选项后自动进入下一题"
            : "本题为选答，可选择答案或直接跳过"}
        </p>
        {!isRequiredAssessmentQuestion(question) && !selectedOption ? (
          <Button variant="outline" onClick={handleSkip}>
            {isLast ? "跳过并查看结果" : "跳过此题"}
          </Button>
        ) : isLast && selectedOption ? (
          <Button
            onClick={() => {
              if (
                areRequiredAssessmentQuestionsAnswered(
                  assessment.questions,
                  answers,
                )
              ) {
                markReadyToSubmit(assessment.id, version);
                goResult();
              }
            }}
          >
            查看结果
          </Button>
        ) : (
          <span className="w-[88px]" />
        )}
      </div>
    </div>
  );
}
