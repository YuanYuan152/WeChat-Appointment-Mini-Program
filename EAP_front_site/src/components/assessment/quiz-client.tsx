"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { QuizProgress } from "./quiz-progress";
import { QuestionCard } from "./question-card";
import { QuizIntro } from "./quiz-intro";
import { Button } from "@/components/ui/button";
import type { Assessment } from "@/lib/api/types";

interface QuizClientProps {
  assessment: Assessment;
  type: "professional" | "fun";
}

function isAssessmentComplete(assessment: Assessment, answers: Record<string, string>) {
  return (
    assessment.questions.length > 0 &&
    assessment.questions.every((q) => answers[q.id])
  );
}

/** 找到第一个未作答的题号；若全部已答则返回最后一题 */
function findResumeIndex(assessment: Assessment, answers: Record<string, string>) {
  const idx = assessment.questions.findIndex((q) => !answers[q.id]);
  if (idx === -1) return Math.max(0, assessment.questions.length - 1);
  return idx;
}

export function QuizClient({ assessment, type }: QuizClientProps) {
  const router = useRouter();
  const {
    getAnswers,
    getCurrentIndex,
    setAnswer,
    setCurrentIndex,
    clearSession,
    markStarted,
    hasInProgress,
    getAnsweredCount,
  } = useQuizSession();

  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<"intro" | "quiz">("intro");
  const advancingRef = useRef(false);

  useEffect(() => {
    const sync = () => setHydrated(true);
    sync();
    return useQuizSession.persist.onFinishHydration(sync);
  }, []);

  const answers = getAnswers(assessment.id);
  const currentIndex = getCurrentIndex(assessment.id);
  const question = assessment.questions[currentIndex];
  const selectedOption = question ? answers[question.id] : undefined;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === assessment.questions.length - 1;
  const canResume = hasInProgress(assessment.id, assessment.questionCount);
  const isComplete = isAssessmentComplete(assessment, answers);
  const answeredCount = getAnsweredCount(assessment.id);

  const goResult = () => {
    router.push(`/assessment/${type}/${assessment.id}/result`);
  };

  const handleStartFresh = () => {
    clearSession(assessment.id);
    markStarted(assessment.id);
    setCurrentIndex(assessment.id, 0);
    setPhase("quiz");
  };

  const handleResume = () => {
    const resumeIdx = findResumeIndex(assessment, getAnswers(assessment.id));
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
        goResult();
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
        <p className="text-xs text-muted-foreground">点选选项后自动进入下一题</p>
        {isLast && selectedOption ? (
          <Button onClick={goResult}>查看结果</Button>
        ) : (
          <span className="w-[88px]" />
        )}
      </div>
    </div>
  );
}
