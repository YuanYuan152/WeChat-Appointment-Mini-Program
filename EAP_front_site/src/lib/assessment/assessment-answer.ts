import type {
  AssessmentAnswerValue,
  AssessmentChoiceAnswer,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentQuestionValidation,
} from "@/lib/api/types";

export function getQuestionInputType(
  question: Pick<AssessmentQuestion, "inputType">,
): "choice" | "text" | "number" {
  return question.inputType || "choice";
}

/** 多选题：选择题且后台主动设置了多选（缺省为单选）。 */
export function isMultipleChoiceQuestion(
  question: Pick<AssessmentQuestion, "inputType" | "multiple">,
): boolean {
  return getQuestionInputType(question) === "choice" && question.multiple === true;
}

/** 选择题里的一个已选项。 */
export interface ChoiceAnswerEntry {
  optionId: string;
  followUp?: string | number;
}

/** 选择题作答里的全部已选项；多选题为数组，单个值按一个已选项处理。 */
export function choiceAnswerEntries(
  answer: AssessmentAnswerValue | undefined,
): ChoiceAnswerEntry[] {
  if (answer == null) return [];
  const raw: unknown[] = Array.isArray(answer) ? answer : [answer];
  const entries: ChoiceAnswerEntry[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      entries.push({ optionId: entry });
    } else if (entry && typeof entry === "object" && "optionId" in entry) {
      const { optionId, followUp } = entry as { optionId?: unknown; followUp?: unknown };
      if (typeof optionId !== "string") continue;
      entries.push(
        typeof followUp === "string" || typeof followUp === "number"
          ? { optionId, followUp }
          : { optionId },
      );
    }
  }
  return entries;
}

/** 按题目选项顺序整理已选项；无追问的选项只存 ID。全部取消时返回 undefined（清空作答）。 */
function orderedMultipleAnswer(
  question: AssessmentQuestion,
  entries: Map<string, ChoiceAnswerEntry>,
): AssessmentChoiceAnswer[] | undefined {
  const next = question.options
    .filter((option) => entries.has(option.id))
    .map((option): AssessmentChoiceAnswer => {
      const followUp = entries.get(option.id)?.followUp;
      if (!option.followUp) return option.id;
      return followUp === undefined || followUp === ""
        ? { optionId: option.id }
        : { optionId: option.id, followUp };
    });
  return next.length > 0 ? next : undefined;
}

function entryMap(answer: AssessmentAnswerValue | undefined) {
  return new Map(choiceAnswerEntries(answer).map((entry) => [entry.optionId, entry]));
}

/** 多选题勾选 / 取消一个选项，其他已选项的追问内容保留。 */
export function toggleMultipleChoiceOption(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue | undefined,
  optionId: string,
): AssessmentChoiceAnswer[] | undefined {
  const entries = entryMap(answer);
  if (entries.has(optionId)) {
    entries.delete(optionId);
  } else {
    entries.set(optionId, { optionId });
  }
  return orderedMultipleAnswer(question, entries);
}

/** 多选题填写某个已选项的追问。 */
export function setMultipleChoiceFollowUp(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue | undefined,
  optionId: string,
  followUp: string | number | undefined,
): AssessmentChoiceAnswer[] | undefined {
  const entries = entryMap(answer);
  if (entries.has(optionId)) {
    entries.set(optionId, followUp === undefined ? { optionId } : { optionId, followUp });
  }
  return orderedMultipleAnswer(question, entries);
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

/** 已选项的追问是否合规：必填追问必须填写；选填追问不填可以，填了要符合限制。 */
function isFollowUpValid(option: AssessmentOption, followUp: unknown): boolean {
  if (!option.followUp) return true;
  if (followUp == null || followUp === "") return !option.followUp.required;
  if (option.followUp.inputType === "text") {
    return isValidTextAnswer(followUp, option.followUp.validation);
  }
  return isValidNumberAnswer(followUp, option.followUp.validation);
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

  if (isMultipleChoiceQuestion(question)) {
    // 多选：至少选一项，选项都要存在且不重复，每个已选项的追问都要合规
    const entries = choiceAnswerEntries(answer);
    if (entries.length === 0) return false;
    const seen = new Set<string>();
    return entries.every((entry) => {
      const option = question.options.find((item) => item.id === entry.optionId);
      if (!option || seen.has(entry.optionId)) return false;
      seen.add(entry.optionId);
      return isFollowUpValid(option, entry.followUp);
    });
  }
  if (Array.isArray(answer)) return false;
  if (typeof answer === "string") {
    const option = question.options.find((item) => item.id === answer);
    return Boolean(option) && !option?.followUp?.required;
  }
  if (typeof answer === "object" && "optionId" in answer) {
    const option = question.options.find((item) => item.id === answer.optionId);
    return Boolean(option) && isFollowUpValid(option as AssessmentOption, answer.followUp);
  }
  return false;
}

export function canAutoAdvanceAfterAnswer(
  question: AssessmentQuestion,
  answer: AssessmentAnswerValue,
): boolean {
  const inputType = getQuestionInputType(question);
  if (inputType !== "choice") return false;
  // 多选题需要选完后手动进入下一题
  if (isMultipleChoiceQuestion(question) || Array.isArray(answer)) return false;
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
