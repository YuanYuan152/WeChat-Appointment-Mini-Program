"use client";

import { Button } from "@/components/ui/button";
import type { Assessment } from "@/lib/api/types";

interface QuizIntroProps {
  assessment: Assessment;
  answeredCount: number;
  canResume: boolean;
  isComplete?: boolean;
  onStartFresh: () => void;
  onResume: () => void;
  onViewResult?: () => void;
}

export function QuizIntro({
  assessment,
  answeredCount,
  canResume,
  isComplete = false,
  onStartFresh,
  onResume,
  onViewResult,
}: QuizIntroProps) {
  return (
    <div className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="font-serif text-xl font-semibold">答题前请阅读</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {assessment.questionCount} 题 · 约 {assessment.duration} 分钟
        </p>
      </div>

      {assessment.instructions ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-primary">指导语</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {assessment.instructions}
          </p>
        </section>
      ) : assessment.description ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-primary">说明</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {assessment.description}
          </p>
        </section>
      ) : null}

      {assessment.features ? (
        <section className="rounded-xl bg-primary/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-primary">测评功能</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {assessment.features}
          </p>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{assessment.disclaimer}</p>

      {isComplete ? (
        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            您已完成本次测评的必答题，可查看报告或重新作答。
          </p>
          <div className="flex flex-wrap gap-3">
            {onViewResult ? <Button onClick={onViewResult}>查看结果</Button> : null}
            <Button variant="outline" onClick={onStartFresh}>
              重新开始
            </Button>
          </div>
        </div>
      ) : canResume ? (
        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            检测到未完成的答题进度（已答 {answeredCount}/{assessment.questionCount} 题），可从中断处继续。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onResume}>继续答题</Button>
            <Button variant="outline" onClick={onStartFresh}>
              重新开始
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border pt-5">
          <Button onClick={onStartFresh} className="w-full sm:w-auto">
            开始答题
          </Button>
        </div>
      )}
    </div>
  );
}
