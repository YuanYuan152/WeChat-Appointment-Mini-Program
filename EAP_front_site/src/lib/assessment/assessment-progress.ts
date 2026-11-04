import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
} from "@/lib/api/types";

function isPresent(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue | undefined,
): boolean {
  if (answer == null) return false;
  const inputType = question.inputType || "choice";
  if (inputType === "text") {
    if (typeof answer !== "object" || !("text" in answer)) return false;
    const text = answer.text;
    if (typeof text !== "string" || !text.trim()) return false;
    if (
      question.validation?.minLength != null &&
      text.length < Number(question.validation.minLength)
    ) {
      return false;
    }
    if (
      question.validation?.maxLength != null &&
      text.length > Number(question.validation.maxLength)
    ) {
      return false;
    }
    return true;
  }
  if (inputType === "number") {
    if (typeof answer !== "object" || !("number" in answer)) return false;
    const number = answer.number;
    if (typeof number !== "number" || !Number.isFinite(number)) return false;
    if (
      question.validation?.min != null &&
      number < Number(question.validation.min)
    ) {
      return false;
    }
    if (
      question.validation?.max != null &&
      number > Number(question.validation.max)
    ) {
      return false;
    }
    return true;
  }

  const options = Array.isArray(question.options) ? question.options : [];
  if (typeof answer === "string") {
    if (options.length === 0) return Boolean(answer);
    const option = options.find((item) => item.id === answer);
    return Boolean(option) && !option?.followUp?.required;
  }
  if (typeof answer === "object" && "optionId" in answer) {
    if (options.length === 0) return Boolean(answer.optionId);
    const option = options.find((item) => item.id === answer.optionId);
    if (!option) return false;
    if (!option.followUp) return true;
    const followUp = answer.followUp;
    if (followUp == null || followUp === "") return !option.followUp.required;
    if (option.followUp.inputType === "text") {
      if (typeof followUp !== "string" || !followUp.trim()) return false;
      if (
        option.followUp.validation?.minLength != null &&
        followUp.length < Number(option.followUp.validation.minLength)
      ) {
        return false;
      }
      if (
        option.followUp.validation?.maxLength != null &&
        followUp.length > Number(option.followUp.validation.maxLength)
      ) {
        return false;
      }
      return true;
    }
    if (typeof followUp !== "number" || !Number.isFinite(followUp)) return false;
    if (
      option.followUp.validation?.min != null &&
      followUp < Number(option.followUp.validation.min)
    ) {
      return false;
    }
    if (
      option.followUp.validation?.max != null &&
      followUp > Number(option.followUp.validation.max)
    ) {
      return false;
    }
    return true;
  }
  return false;
}

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
        isPresent(question, answers[question.id]),
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
    !isPresent(questions[currentIndex], answers[questions[currentIndex].id])
  ) {
    return currentIndex;
  }
  const requiredIndex = questions.findIndex(
    (question) =>
      isRequiredAssessmentQuestion(question) &&
      !isPresent(question, answers[question.id]),
  );
  if (requiredIndex >= 0) {
    return requiredIndex;
  }
  const unansweredIndex = questions.findIndex(
    (question) => !isPresent(question, answers[question.id]),
  );
  return unansweredIndex >= 0
    ? unansweredIndex
    : Math.max(0, questions.length - 1);
}
