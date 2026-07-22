"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface QuizDemographics {
  name: string;
  gender: "男" | "女";
  age: number;
}

interface QuizDemographicsFormProps {
  initial?: Partial<QuizDemographics> | null;
  onSubmit: (data: QuizDemographics) => void;
  onBack?: () => void;
}

const GENDER_OPTIONS: QuizDemographics["gender"][] = ["男", "女"];

export function QuizDemographicsForm({
  initial,
  onSubmit,
  onBack,
}: QuizDemographicsFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gender, setGender] = useState<QuizDemographics["gender"] | "">(
    initial?.gender ?? ""
  );
  const [age, setAge] = useState(
    initial?.age != null && Number.isFinite(initial.age) ? String(initial.age) : ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): QuizDemographics | null => {
    const next: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) next.name = "请填写姓名";
    else if (trimmedName.length > 30) next.name = "姓名请控制在 30 字以内";

    if (!gender) next.gender = "请选择性别";

    const ageNum = Number(age);
    if (!age.trim()) next.age = "请填写年龄";
    else if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      next.age = "请输入 1–120 的整数年龄";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return { name: trimmedName, gender: gender as QuizDemographics["gender"], age: ageNum };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (data) onSubmit(data);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="font-serif text-xl font-semibold">填写基本信息</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          专业测评开始前，请填写以下信息，便于生成更准确的报告。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="quiz-name">姓名</Label>
          <Input
            id="quiz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入真实姓名"
            autoComplete="name"
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label>性别</Label>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setGender(opt)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm transition-colors",
                  gender === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          {errors.gender ? <p className="text-xs text-destructive">{errors.gender}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-age">年龄</Label>
          <Input
            id="quiz-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="请输入年龄"
          />
          {errors.age ? <p className="text-xs text-destructive">{errors.age}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              返回
            </Button>
          ) : null}
          <Button type="submit" className="min-w-[120px]">
            确认并开始答题
          </Button>
        </div>
      </form>
    </div>
  );
}
