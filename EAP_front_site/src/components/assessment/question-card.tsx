"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  choiceAnswerEntries,
  isMultipleChoiceQuestion,
  setMultipleChoiceFollowUp,
  toggleMultipleChoiceOption,
} from "@/lib/assessment/assessment-answer";
import type {
  AssessmentAnswerValue,
  AssessmentOptionFollowUp,
  AssessmentQuestion,
} from "@/lib/api/types";

interface QuestionCardProps {
  question: AssessmentQuestion;
  answer?: AssessmentAnswerValue;
  onAnswer: (value: AssessmentAnswerValue | undefined) => void;
  index: number;
}

function selectedOptionId(answer?: AssessmentAnswerValue): string | undefined {
  if (typeof answer === "string") return answer;
  if (answer && typeof answer === "object" && "optionId" in answer) {
    return answer.optionId;
  }
  return undefined;
}

function followUpValue(answer?: AssessmentAnswerValue): string | number | undefined {
  if (answer && typeof answer === "object" && "optionId" in answer) {
    return answer.followUp;
  }
  return undefined;
}

const optionButtonClass = (selected: boolean) =>
  cn(
    "w-full rounded-xl border px-5 py-4 text-left text-sm transition-all",
    selected
      ? "border-primary bg-primary/5 font-medium text-primary shadow-sm"
      : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
  );

/** 选项追问的填写框：单选题跟在所选选项下方；多选题每个已选的带追问选项各一个。 */
function FollowUpInput({
  followUp,
  value,
  onChange,
}: {
  followUp: AssessmentOptionFollowUp;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <div className="mb-2 text-xs text-muted-foreground">
        {followUp.label || "请补充填写"}
        {followUp.required ? "（必填）" : ""}
      </div>
      {followUp.inputType === "number" ? (
        <input
          aria-label={followUp.label || "请补充填写"}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-primary sm:text-sm"
          inputMode="decimal"
          type="number"
          min={followUp.validation?.min}
          max={followUp.validation?.max}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = Number(raw);
            onChange(raw === "" || !Number.isFinite(parsed) ? undefined : parsed);
          }}
        />
      ) : (
        <input
          aria-label={followUp.label || "请补充填写"}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-primary sm:text-sm"
          minLength={followUp.validation?.minLength}
          maxLength={followUp.validation?.maxLength}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === "" ? undefined : raw);
          }}
        />
      )}
    </div>
  );
}

export function QuestionCard({
  question,
  answer,
  onAnswer,
  index,
}: QuestionCardProps) {
  const inputType = question.inputType || "choice";
  const multiple = isMultipleChoiceQuestion(question);
  const selectedEntries = multiple ? choiceAnswerEntries(answer) : [];

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        第 {index + 1} 题
        {multiple && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            多选
          </span>
        )}
      </div>
      <h2 className="mb-6 whitespace-pre-line font-serif text-xl font-semibold leading-relaxed sm:text-2xl">
        {question.text}
      </h2>

      {inputType === "text" && (
        <textarea
          aria-label={question.text}
          className="min-h-28 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary sm:text-sm"
          placeholder={question.helpText || "请填写"}
          minLength={question.validation?.minLength}
          maxLength={question.validation?.maxLength}
          value={
            answer && typeof answer === "object" && "text" in answer
              ? answer.text
              : ""
          }
          onChange={(event) => {
            const text = event.target.value;
            onAnswer(text.trim() ? { text } : undefined);
          }}
        />
      )}

      {inputType === "number" && (
        <input
          aria-label={question.text}
          className="h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:border-primary sm:text-sm"
          placeholder={question.helpText || "请填写数字"}
          inputMode="decimal"
          type="number"
          min={question.validation?.min}
          max={question.validation?.max}
          value={
            answer &&
            typeof answer === "object" &&
            "number" in answer &&
            Number.isFinite(answer.number)
              ? answer.number
              : ""
          }
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onAnswer(undefined);
              return;
            }
            const parsed = Number(raw);
            onAnswer(Number.isFinite(parsed) ? { number: parsed } : undefined);
          }}
        />
      )}

      {inputType === "choice" && multiple && (
        <div className="space-y-3" role="group" aria-label={question.text}>
          {question.options.map((option) => {
            const entry = selectedEntries.find((item) => item.optionId === option.id);
            const selected = Boolean(entry);
            return (
              <div key={option.id} className="space-y-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => onAnswer(toggleMultipleChoiceOption(question, answer, option.id))}
                  className={cn(optionButtonClass(selected), "flex items-start gap-3")}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-card",
                    )}
                  >
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">{option.text}</span>
                </button>
                {selected && option.followUp && (
                  <FollowUpInput
                    followUp={option.followUp}
                    value={entry?.followUp}
                    onChange={(value) =>
                      onAnswer(setMultipleChoiceFollowUp(question, answer, option.id, value))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {inputType === "choice" && !multiple && (
        <div className="space-y-3" role="radiogroup" aria-label={question.text}>
          {question.options.map((option) => {
            const selected = selectedOptionId(answer) === option.id;
            return (
              <div key={option.id} className="space-y-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    if (option.followUp) {
                      onAnswer({
                        optionId: option.id,
                        followUp: selected ? followUpValue(answer) : undefined,
                      });
                      return;
                    }
                    onAnswer(option.id);
                  }}
                  className={optionButtonClass(selected)}
                >
                  {option.text}
                </button>
                {selected && option.followUp && (
                  <FollowUpInput
                    followUp={option.followUp}
                    value={followUpValue(answer)}
                    onChange={(value) => onAnswer({ optionId: option.id, followUp: value })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
