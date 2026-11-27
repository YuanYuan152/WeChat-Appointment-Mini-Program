"use client";

import type { ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  areDemographicAnswersComplete,
  demographicValueIssue,
  isDemographicValueEmpty,
  sameDemographicValue,
} from "@/lib/assessment/demographic-answers";
import type { DemographicQuestion } from "@/lib/api/types";

/** 选项不多时用按钮排开，便于手机上点选；更多选项用下拉框。 */
const MAX_INLINE_OPTIONS = 6;

const optionButtonClass = (selected: boolean) =>
  cn(
    "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-sm transition-all",
    selected
      ? "border-primary bg-primary/5 font-medium text-primary shadow-sm"
      : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
  );

export function DemographicField({
  question,
  value,
  onChange,
}: {
  question: DemographicQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const labelId = `demographic-${question.id}-label`;
  const inputId = `demographic-${question.id}`;
  const issue = demographicValueIssue(question, value);
  const options = question.options ?? [];

  let control: ReactNode;
  if (question.inputType === "single" && options.length <= MAX_INLINE_OPTIONS) {
    control = (
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = sameDemographicValue(value, option.value);
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={optionButtonClass(selected)}
              onClick={() => onChange(selected && !question.required ? undefined : option.value)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary" : "border-muted-foreground/40",
                )}
              >
                {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0">{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (question.inputType === "single") {
    const selected = options.find((option) => sameDemographicValue(value, option.value));
    control = (
      <select
        id={inputId}
        aria-labelledby={labelId}
        value={selected?.id ?? ""}
        onChange={(event) => {
          const option = options.find((item) => item.id === event.target.value);
          onChange(option ? option.value : undefined);
        }}
        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
      >
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.text}
          </option>
        ))}
      </select>
    );
  } else if (question.inputType === "multiple") {
    const selectedValues = Array.isArray(value) ? value : [];
    control = (
      <div role="group" aria-labelledby={labelId} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = selectedValues.some((item) => sameDemographicValue(item, option.value));
          return (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className={optionButtonClass(checked)}
              onClick={() =>
                onChange(
                  checked
                    ? selectedValues.filter((item) => !sameDemographicValue(item, option.value))
                    : // 按选项原顺序保存
                      options
                        .filter(
                          (item) =>
                            item.id === option.id ||
                            selectedValues.some((selectedValue) =>
                              sameDemographicValue(selectedValue, item.value),
                            ),
                        )
                        .map((item) => item.value),
                )
              }
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {checked ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0">{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  } else {
    const isNumber = question.inputType === "number";
    control = (
      <Input
        id={inputId}
        aria-labelledby={labelId}
        type={isNumber ? "number" : question.inputType === "date" ? "date" : "text"}
        inputMode={isNumber ? "decimal" : undefined}
        className="text-base sm:text-sm"
        placeholder={question.helpText ? undefined : isNumber ? "请填写数字" : "请填写"}
        value={value == null ? "" : String(value)}
        min={question.validation?.min}
        max={question.validation?.max}
        minLength={question.validation?.minLength}
        maxLength={question.validation?.maxLength}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          if (isNumber) {
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : undefined);
            return;
          }
          onChange(raw);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-2">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {question.text}
          {question.required ? (
            <span className="ml-1 text-destructive">*</span>
          ) : (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">选填</span>
          )}
        </span>
        {question.helpText ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{question.helpText}</p>
        ) : null}
      </div>
      {control}
      {issue ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {issue}
        </p>
      ) : null}
    </div>
  );
}

interface DemographicFormProps {
  questions: DemographicQuestion[];
  values: Record<string, unknown>;
  onChange: (questionId: string, value: unknown) => void;
  onSubmit: () => void;
  onBack?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
}

/** 量表的人口学信息表：作答前填写（结果页仅在缺少时补填）。 */
export function DemographicForm({
  questions,
  values,
  onChange,
  onSubmit,
  onBack,
  title = "填写基本信息",
  description,
  submitLabel = "开始答题",
  submitting = false,
  error,
}: DemographicFormProps) {
  const complete = areDemographicAnswersComplete(questions, values);
  const missingRequired = questions.filter(
    (question) => question.required && isDemographicValueEmpty(values[question.id]),
  ).length;

  return (
    <form
      noValidate
      className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete && !submitting) {
          onSubmit();
        }
      }}
    >
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6 space-y-6">
        {questions.map((question) => (
          <DemographicField
            key={question.id}
            question={question}
            value={values[question.id]}
            onChange={(value) => onChange(question.id, value)}
          />
        ))}
      </div>
      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            返回
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 sm:items-end">
          {!complete ? (
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              {missingRequired > 0
                ? `还有 ${missingRequired} 项必填信息未填写`
                : "请修改标红的内容后继续"}
            </p>
          ) : null}
          <Button type="submit" disabled={!complete || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
