"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuizSession } from "@/lib/stores/quiz-session";
import { QuizProgress } from "./quiz-progress";
import { QuestionCard } from "./question-card";
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

export function QuizClient({ assessment, type }: QuizClientProps) {
  const router = useRouter();
  const { getAnswers, getCurrentIndex, setAnswer, setCurrentIndex, clearSession } =
    useQuizSession();

  useEffect(() => {
    const resetIfCompleted = () => {
      const answers = useQuizSession.getState().getAnswers(assessment.id);
      if (isAssessmentComplete(assessment, answers)) {
        clearSession(assessment.id);
      }
    };

    resetIfCompleted();
    return useQuizSession.persist.onFinishHydration(resetIfCompleted);
  }, [assessment, clearSession]);

  const answers = getAnswers(assessment.id);
  const currentIndex = getCurrentIndex(assessment.id);
  const question = assessment.questions[currentIndex];
  const selectedOption = answers[question?.id];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === assessment.questions.length - 1;

  const handleNext = () => {
    if (!selectedOption) return;
    if (isLast) {
      router.push(`/assessment/${type}/${assessment.id}/result`);
    } else {
      setCurrentIndex(assessment.id, currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentIndex(assessment.id, currentIndex - 1);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <QuizProgress current={currentIndex} total={assessment.questions.length} />
      <QuestionCard
        question={question}
        selectedOptionId={selectedOption}
        onSelect={(optionId) => setAnswer(assessment.id, question.id, optionId)}
        index={currentIndex}
      />
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={isFirst}>
          上一题
        </Button>
        <Button onClick={handleNext} disabled={!selectedOption}>
          {isLast ? "查看结果" : "下一题"}
        </Button>
      </div>
    </div>
  );
}
