"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/booking/star-rating";
import { fetchConsultations, submitConsultationFeedback } from "@/lib/booking/api";
import type { ConsultationRecord } from "@/lib/booking/types";
import {
  GOAL_QUESTION,
  RHYTHM_QUESTION,
  IMPROVEMENT_QUESTION,
  IMPROVEMENT_OPTIONS,
  NONE_IMPROVEMENT,
  goalScoreHint,
  rhythmScoreHint,
} from "@/lib/booking/consultation-feedback";
import { formatSlotRange } from "@/lib/booking/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

export function ConsultationFeedbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const consultationId = Number(searchParams.get("consultationId") || 0);

  const [record, setRecord] = useState<ConsultationRecord | null>(null);
  const [goalScore, setGoalScore] = useState(0);
  const [rhythmScore, setRhythmScore] = useState(0);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`/consultation/records/feedback?consultationId=${consultationId}`)}`);
      return;
    }
    if (!consultationId) {
      setLoading(false);
      setError("缺少预约信息");
      return;
    }
    fetchConsultations(token)
      .then((rows) => {
        const found = rows.find((r) => r.id === consultationId) ?? null;
        setRecord(found);
        if (!found) setError("预约记录不存在");
        else if (found.status !== "DONE") setError("仅已完成的咨询可提交反馈");
        else if (found.hasFeedback) setError("该咨询已提交过反馈");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [token, consultationId, router]);

  const toggleImprovement = (opt: string) => {
    if (opt === NONE_IMPROVEMENT) {
      setImprovements((prev) => (prev.includes(opt) ? [] : [opt]));
      return;
    }
    setImprovements((prev) => {
      const next = prev.filter((x) => x !== NONE_IMPROVEMENT);
      return next.includes(opt) ? next.filter((x) => x !== opt) : [...next, opt];
    });
  };

  const handleSubmit = async () => {
    if (!token || !consultationId) return;
    setSubmitting(true);
    setError("");
    try {
      await submitConsultationFeedback(token, consultationId, {
        goalScore: goalScore || null,
        rhythmScore: rhythmScore || null,
        improvements,
      });
      router.push("/consultation/records?tab=feedbacked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div>
      <Link
        href="/consultation/records"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回预约记录
      </Link>

      {loading && <p className="py-12 text-center text-muted-foreground">加载中…</p>}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {record && !error && !loading && (
        <div className="space-y-6">
          <div className="rounded-[var(--radius)] border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">咨询师</p>
            <p className="mt-1 font-medium">{record.counselorName}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatSlotRange(record.startTime, record.endTime)}
            </p>
          </div>

          <div className="space-y-8 rounded-[var(--radius)] border border-border bg-card p-6">
            <div>
              <p className="font-medium">{GOAL_QUESTION}</p>
              <div className="mt-3">
                <StarRating value={goalScore} onChange={setGoalScore} />
              </div>
              {goalScore > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">{goalScoreHint(goalScore)}</p>
              )}
            </div>

            <div>
              <p className="font-medium">{RHYTHM_QUESTION}</p>
              <div className="mt-3">
                <StarRating value={rhythmScore} onChange={setRhythmScore} />
              </div>
              {rhythmScore > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">{rhythmScoreHint(rhythmScore)}</p>
              )}
            </div>

            <div>
              <p className="font-medium">【多选】{IMPROVEMENT_QUESTION}</p>
              <div className="mt-4 space-y-2">
                {IMPROVEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleImprovement(opt)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      improvements.includes(opt)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border text-xs",
                        improvements.includes(opt)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {improvements.includes(opt) ? "✓" : ""}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "提交中…" : "提交反馈"}
          </Button>
        </div>
      )}
    </div>
  );
}
