import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
  AssessmentQuestionValidation,
} from "@/lib/api/types";

export function getQuestionInputType(
  question: Pick<AssessmentQuestion, "inputType">,
): "choice" | "text" | "number" {
  return question.inputType || "choice";
}

function isValidTextAnswer(
  value: unknown,
  validation?: AssessmentQuestionValidation,
): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (
    validation?.minLength != null &&
    value.length < Number(validation.minLength)
  ) {
    return false;
  }
  if (
    validation?.maxLength != null &&
    value.length > Number(validation.maxLength)
  ) {
    return false;
  }
  return true;
}

function isValidNumberAnswer(
  value: unknown,
  validation?: AssessmentQuestionValidation,
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (validation?.min != null && value < Number(validation.min)) return false;
  if (validation?.max != null && value > Number(validation.max)) return false;
  return true;
}

export function isAssessmentAnswerPresent(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue | undefined,
): boolean {
  if (answer == null) return false;
  const inputType = getQuestionInputType(question);
  if (inputType === "text") {
    return (
      typeof answer === "object" &&
      "text" in answer &&
      isValidTextAnswer(answer.text, question.validation)
    );
  }
  if (inputType === "number") {
    return (
      typeof answer === "object" &&
      "number" in answer &&
      isValidNumberAnswer(answer.number, question.validation)
    );
  }

  if (typeof answer === "string") {
    const option = question.options.find((item) => item.id === answer);
    return Boolean(option) && !option?.followUp?.required;
  }
  if (typeof answer === "object" && "optionId" in answer) {
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) return false;
    if (!option.followUp) return true;
    const followUp = answer.followUp;
    const isEmpty = followUp == null || followUp === "";
    if (isEmpty) return !option.followUp.required;
    if (option.followUp.inputType === "text") {
      return isValidTextAnswer(followUp, option.followUp.validation);
    }
    return isValidNumberAnswer(followUp, option.followUp.validation);
  }
  return false;
}

export function canAutoAdvanceAfterAnswer(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue,
): boolean {
  const inputType = getQuestionInputType(question);
  if (inputType !== "choice") return false;
  if (typeof answer === "string") {
    const option = question.options.find((item) => item.id === answer);
    return Boolean(option) && !option?.followUp;
  }
  if (typeof answer === "object" && "optionId" in answer) {
    const option = question.options.find((item) => item.id === answer.optionId);
    return Boolean(option) && !option?.followUp;
  }
  return false;
}
