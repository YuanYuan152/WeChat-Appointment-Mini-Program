import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
} from "@/lib/api/types";
import { isAssessmentAnswerPresent } from "@/lib/assessment/assessment-answer";

type ProgressQuestion = AssessmentQuestion;

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
  question: Pick<AssessmentQuestion, "required">,
): boolean {
  return question.required !== false;
}

export function areRequiredAssessmentQuestionsAnswered(
  questions: ProgressQuestion[],
  answers: Record<string, AssessmentAnswerValue>,
): boolean {
  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        !isRequiredAssessmentQuestion(question) ||
        isAssessmentAnswerPresent(question, answers[question.id]),
    )
  );
}

export function findAssessmentResumeQuestionIndex(
  questions: ProgressQuestion[],
  answers: Record<string, AssessmentAnswerValue>,
  currentIndex: number,
): number {
  if (
    currentIndex >= 0 &&
    currentIndex < questions.length &&
    !isAssessmentAnswerPresent(questions[currentIndex], answers[questions[currentIndex].id])
  ) {
    return currentIndex;
  }
  const requiredIndex = questions.findIndex(
    (question) =>
      isRequiredAssessmentQuestion(question) &&
      !isAssessmentAnswerPresent(question, answers[question.id]),
  );
  if (requiredIndex >= 0) {
    return requiredIndex;
  }
  const unansweredIndex = questions.findIndex(
    (question) => !isAssessmentAnswerPresent(question, answers[question.id]),
  );
  return unansweredIndex >= 0
    ? unansweredIndex
    : Math.max(0, questions.length - 1);
}
