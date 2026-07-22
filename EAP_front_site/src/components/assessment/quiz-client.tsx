"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { useAuthStore } from "@/lib/stores/auth-store";
import { QuizProgress } from "./quiz-progress";
import { QuestionCard } from "./question-card";
import { QuizIntro } from "./quiz-intro";
import {
  QuizDemographicsForm,
  type QuizDemographics,
} from "./quiz-demographics-form";
import { Button } from "@/components/ui/button";
import type { Assessment } from "@/lib/api/types";

interface QuizClientProps {
  assessment: Assessment;
  type: "professional" | "fun";
}

type QuizPhase = "intro" | "profile" | "quiz";
type PendingAction = "fresh" | "resume";

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

function normalizeGender(value?: string | null): QuizDemographics["gender"] | undefined {
  if (!value) return undefined;
  if (value === "男" || value === "女") return value;
  if (/male|^m$|男/i.test(value)) return "男";
  if (/female|^f$|女/i.test(value)) return "女";
  return undefined;
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
    setDemographics,
    getDemographics,
  } = useQuizSession();
  const authUser = useAuthStore((s) => s.user);

  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [pendingAction, setPendingAction] = useState<PendingAction>("fresh");
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
  const needsDemographics = type === "professional";

  const goResult = () => {
    router.push(`/assessment/${type}/${assessment.id}/result`);
  };

  const beginQuiz = (action: PendingAction) => {
    if (action === "fresh") {
      clearSession(assessment.id);
      markStarted(assessment.id);
      setCurrentIndex(assessment.id, 0);
    } else {
      const resumeIdx = findResumeIndex(assessment, getAnswers(assessment.id));
      markStarted(assessment.id);
      setCurrentIndex(assessment.id, resumeIdx);
    }
    setPhase("quiz");
  };

  const requestStart = (action: PendingAction) => {
    if (!needsDemographics) {
      beginQuiz(action);
      return;
    }
    // 续答且已有基本信息：直接继续
    if (action === "resume" && getDemographics(assessment.id)) {
      beginQuiz(action);
      return;
    }
    setPendingAction(action);
    setPhase("profile");
  };

  const handleStartFresh = () => requestStart("fresh");
  const handleResume = () => requestStart("resume");

  const handleDemographicsSubmit = (data: QuizDemographics) => {
    // 重新开始时先清会话，再写入基本信息
    if (pendingAction === "fresh") {
      clearSession(assessment.id);
    }
    setDemographics(assessment.id, data);
    markStarted(assessment.id);
    if (pendingAction === "fresh") {
      setCurrentIndex(assessment.id, 0);
    } else {
      const resumeIdx = findResumeIndex(assessment, getAnswers(assessment.id));
      setCurrentIndex(assessment.id, resumeIdx);
    }
    setPhase("quiz");
  };

  const handleSelect = (optionId: string) => {
    if (!question || advancingRef.current) return;
    setAnswer(assessment.id, question.id, optionId);

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

  if (phase === "profile") {
    const existing = getDemographics(assessment.id);
    const initial: Partial<QuizDemographics> = {
      name: existing?.name || authUser?.realName || authUser?.nickname || "",
      gender: normalizeGender(existing?.gender || authUser?.gender),
      age: existing?.age,
    };
    return (
      <QuizDemographicsForm
        initial={initial}
        onSubmit={handleDemographicsSubmit}
        onBack={() => setPhase("intro")}
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
