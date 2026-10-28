"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type {
  AssessmentAnswerValue,
  AssessmentQuestion,
} from "@/lib/api/types";

interface QuestionCardProps {
  question: AssessmentQuestion;
  answer?: AssessmentAnswerValue;
  onAnswer: (value: AssessmentAnswerValue) => void;
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

export function QuestionCard({
  question,
  answer,
  onAnswer,
  index,
}: QuestionCardProps) {
  const inputType = question.inputType || "choice";

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-2 text-sm text-muted-foreground">第 {index + 1} 题</div>
      <h2 className="mb-6 whitespace-pre-line font-serif text-xl font-semibold leading-relaxed sm:text-2xl">
        {question.text}
      </h2>

      {inputType === "text" && (
        <textarea
          className="min-h-28 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
          placeholder={question.helpText || "请填写"}
          value={
            answer && typeof answer === "object" && "text" in answer
              ? answer.text
              : ""
          }
          onChange={(event) => onAnswer({ text: event.target.value })}
        />
      )}

      {inputType === "number" && (
        <input
          className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
          placeholder={question.helpText || "请填写数字"}
          type="number"
          min={question.validation?.min}
          max={question.validation?.max}
          value={
            answer && typeof answer === "object" && "number" in answer
              ? answer.number
              : ""
          }
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onAnswer({ number: Number.NaN });
              return;
            }
            onAnswer({ number: Number(raw) });
          }}
        />
      )}

      {inputType === "choice" && (
        <div className="space-y-3">
          {question.options.map((option) => {
            const selected = selectedOptionId(answer) === option.id;
            return (
              <div key={option.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (option.followUp) {
                      onAnswer({
                        optionId: option.id,
                        followUp: followUpValue(answer),
                      });
                      return;
                    }
                    onAnswer(option.id);
                  }}
                  className={cn(
                    "w-full rounded-xl border px-5 py-4 text-left text-sm transition-all",
                    selected
                      ? "border-primary bg-primary/5 font-medium text-primary shadow-sm"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  {option.text}
                </button>
                {selected && option.followUp && (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
                    <div className="mb-2 text-xs text-muted-foreground">
                      {option.followUp.label || "请补充填写"}
                      {option.followUp.required ? "（必填）" : ""}
                    </div>
                    {option.followUp.inputType === "number" ? (
                      <input
                        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        type="number"
                        min={option.followUp.validation?.min}
                        max={option.followUp.validation?.max}
                        value={
                          typeof followUpValue(answer) === "number"
                            ? (followUpValue(answer) as number)
                            : ""
                        }
                        onChange={(event) => {
                          const raw = event.target.value;
                          onAnswer({
                            optionId: option.id,
                            followUp: raw === "" ? undefined : Number(raw),
                          });
                        }}
                      />
                    ) : (
                      <input
                        className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        value={
                          typeof followUpValue(answer) === "string"
                            ? (followUpValue(answer) as string)
                            : ""
                        }
                        onChange={(event) =>
                          onAnswer({
                            optionId: option.id,
                            followUp: event.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
