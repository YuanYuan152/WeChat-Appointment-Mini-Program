import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
} from "@/lib/api/types";

export function getQuestionInputType(
  question: Pick<AssessmentQuestion, "inputType">,
): "choice" | "text" | "number" {
  return question.inputType || "choice";
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
      Boolean(String(answer.text || "").trim())
    );
  }
  if (inputType === "number") {
    return (
      typeof answer === "object" &&
      "number" in answer &&
      typeof answer.number === "number" &&
      Number.isFinite(answer.number)
    );
  }

  if (typeof answer === "string") {
    const option = question.options.find((item) => item.id === answer);
    return Boolean(option) && !option?.followUp;
  }
  if (typeof answer === "object" && "optionId" in answer) {
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) return false;
    if (!option.followUp) return true;
    if (!option.followUp.required) return true;
    if (option.followUp.inputType === "text") {
      return typeof answer.followUp === "string" && Boolean(answer.followUp.trim());
    }
    return typeof answer.followUp === "number" && Number.isFinite(answer.followUp);
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
