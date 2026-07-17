"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Share2, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBeginAssessment } from "@/components/assessment/start-assessment-button";
import type { Assessment, AssessmentScoreResult } from "@/lib/api/types";

interface ReportViewProps {
  assessment: Assessment;
  result: AssessmentScoreResult;
  type: "professional" | "fun";
  showActions?: boolean;
}

export function ReportView({ assessment, result, type, showActions = true }: ReportViewProps) {
  const beginAssessment = useBeginAssessment();

  const handleShare = () => {
    if (result.type === "match") {
      navigator.clipboard?.writeText(result.shareText);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      {result.type === "sum" ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">测评得分</p>
            <div className="my-4 font-serif text-6xl font-bold text-primary">
              {result.totalScore}
            </div>
            <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              {result.level}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <h3 className="mb-2 font-serif font-semibold">结果解读</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.description}
              </p>
            </div>

            {result.suggestions.length > 0 && (
              <div>
                <h3 className="mb-2 font-serif font-semibold">建议</h3>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : result.type === "dimension" ? (
        <div className="space-y-4">
          {assessment.reportIntro && (
            <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
              <p className="text-sm leading-relaxed text-muted-foreground">{assessment.reportIntro}</p>
            </div>
          )}
          {result.summary && (
            <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center shadow-sm">
              <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
            </div>
          )}
          {result.dimensions.map((dim) => {
            const dimDef = assessment.dimensions?.find((d) => d.id === dim.id);
            return (
            <div
              key={dim.id}
              className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-serif font-semibold">{dim.title}</h3>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-2xl font-bold text-primary">{dim.score}</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {dim.level}
                  </span>
                </div>
              </div>
              {dimDef?.intro && (
                <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  {dimDef.intro}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{dim.description}</p>
              {dim.suggestions.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {dim.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
          <div className="relative aspect-[16/9]">
            <Image src={result.image} alt={result.title} fill className="object-cover" sizes="600px" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <p className="text-sm opacity-80">你的结果是</p>
              <h2 className="font-serif text-3xl font-bold">{result.title}</h2>
            </div>
          </div>
          <div className="p-6">
            <p className="leading-relaxed text-muted-foreground">{result.description}</p>
            <p className="mt-4 rounded-xl bg-muted p-4 text-sm italic text-muted-foreground">
              「{result.shareText}」
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{assessment.disclaimer}</span>
      </div>

      {showActions && (
        <div className="mt-6 flex flex-wrap gap-3">
          {result.type === "match" && (
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              复制分享文案
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => beginAssessment(assessment.id, type)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            重新测试
          </Button>
          <Link href="/assessment/reports">
            <Button variant="outline">我的报告</Button>
          </Link>
          <Link href={`/assessment/${type}`}>
            <Button>返回列表</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
