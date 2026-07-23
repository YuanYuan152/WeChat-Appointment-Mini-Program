import type { AssessmentQuestion } from "@/lib/api/types";

type ProgressQuestion = Pick<AssessmentQuestion, "id" | "required">;

export function shouldCreateFreshAssessmentAttempt({
  started,
  answeredCount,
  completed,
}: {
  started: boolean;
  answeredCount: number;
  completed: boolean;
}): boolean {
  return started || answeredCount > 0 || completed;
}

export function isRequiredAssessmentQuestion(
  question: ProgressQuestion,
): boolean {
  return question.required !== false;
}

export function areRequiredAssessmentQuestionsAnswered(
  questions: ProgressQuestion[],
  answers: Record<string, string>,
): boolean {
  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        !isRequiredAssessmentQuestion(question) || Boolean(answers[question.id]),
    )
  );
}

export function findAssessmentResumeQuestionIndex(
  questions: ProgressQuestion[],
  answers: Record<string, string>,
  currentIndex: number,
): number {
  if (
    currentIndex >= 0 &&
    currentIndex < questions.length &&
    !answers[questions[currentIndex].id]
  ) {
    return currentIndex;
  }
  const requiredIndex = questions.findIndex(
    (question) =>
      isRequiredAssessmentQuestion(question) && !answers[question.id],
  );
  if (requiredIndex >= 0) {
    return requiredIndex;
  }
  const unansweredIndex = questions.findIndex(
    (question) => !answers[question.id],
  );
  return unansweredIndex >= 0
    ? unansweredIndex
    : Math.max(0, questions.length - 1);
}
