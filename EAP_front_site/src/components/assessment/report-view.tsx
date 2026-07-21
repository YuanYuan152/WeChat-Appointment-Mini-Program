"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Share2, RotateCcw, AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBeginAssessment } from "@/components/assessment/start-assessment-button";
import { downloadAssessmentReportPdf } from "@/lib/assessment/download-report-pdf";
import {
  DimensionBar,
  DimensionRadar,
  ScoreRing,
  getRangeMax,
  getRangeMin,
} from "@/components/assessment/report-score-visuals";
import type { Assessment, AssessmentScoreResult } from "@/lib/api/types";

interface ReportViewProps {
  assessment: Assessment;
  result: AssessmentScoreResult;
  type: "professional" | "fun";
  showActions?: boolean;
}

export function ReportView({ assessment, result, type, showActions = true }: ReportViewProps) {
  const beginAssessment = useBeginAssessment();
  const [downloading, setDownloading] = useState(false);

  const handleShare = () => {
    if (result.type === "match") {
      navigator.clipboard?.writeText(result.shareText);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAssessmentReportPdf({
        assessment,
        result,
      });
    } catch (err) {
      console.error("download pdf failed", err);
      alert("PDF 下载失败，请稍后重试。若仍失败，可使用浏览器打印并选择「另存为 PDF」。");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      <div className="space-y-4 bg-background p-1">
        <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">测评报告</p>
              <h1 className="mt-1 font-serif text-xl font-bold">{assessment.title}</h1>
              {assessment.subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{assessment.subtitle}</p>
              ) : null}
            </div>
            <Button
              variant="default"
              size="sm"
              className="no-print shrink-0"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {downloading ? "生成中…" : "下载 PDF"}
            </Button>
          </div>
        </div>

        {result.type === "sum" ? (
          <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-sm">
            {(assessment.reportIntro || assessment.features) && (
              <div className="mb-6 rounded-xl bg-primary/5 p-4">
                <h3 className="mb-2 text-sm font-semibold text-primary">测评说明</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {assessment.reportIntro || assessment.features}
                </p>
              </div>
            )}

            <ScoreRing
              score={result.totalScore}
              max={getRangeMax(assessment.scoreRanges)}
              level={result.level}
              label="测评得分"
            />

            {/* 区间色带 */}
            {assessment.scoreRanges && assessment.scoreRanges.length > 0 ? (
              <div className="mt-8 space-y-2">
                <p className="text-center text-xs text-muted-foreground">得分区间参考</p>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {(() => {
                    const min = getRangeMin(assessment.scoreRanges);
                    const max = getRangeMax(assessment.scoreRanges);
                    const span = Math.max(1, max - min);
                    const colors = [
                      "bg-emerald-400",
                      "bg-amber-400",
                      "bg-orange-400",
                      "bg-rose-400",
                    ];
                    return assessment.scoreRanges!.map((r, i) => (
                      <div
                        key={`${r.min}-${r.max}`}
                        className={colors[i % colors.length]}
                        style={{
                          width: `${Math.max(6, ((r.max - r.min) / span) * 100)}%`,
                        }}
                        title={`${r.level} ${r.min}-${r.max}`}
                      />
                    ));
                  })()}
                </div>
                <div className="flex justify-between gap-1 text-[10px] text-muted-foreground">
                  {assessment.scoreRanges.map((r) => (
                    <span key={`${r.level}-${r.min}`} className="flex-1 text-center">
                      {r.level}
                      <br />
                      {r.min}–{r.max}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

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
            {(assessment.reportIntro || assessment.features) && (
              <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-primary">测评说明</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {assessment.reportIntro || assessment.features}
                </p>
              </div>
            )}

            {result.summary && (
              <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center shadow-sm">
                <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
              </div>
            )}

            <DimensionRadar
              dimensions={result.dimensions}
              getMax={(id) =>
                getRangeMax(assessment.dimensions?.find((d) => d.id === id)?.scoreRanges)
              }
            />

            {result.dimensions.map((dim) => {
              const dimDef = assessment.dimensions?.find((d) => d.id === dim.id);
              const max = getRangeMax(dimDef?.scoreRanges);
              const min = getRangeMin(dimDef?.scoreRanges);
              return (
                <div
                  key={dim.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
                >
                  <DimensionBar
                    dim={dim}
                    max={max}
                    min={min}
                    ranges={dimDef?.scoreRanges}
                  />
                  {dimDef?.intro && (
                    <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                      {dimDef.intro}
                    </p>
                  )}
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {dim.description}
                  </p>
                  {dim.suggestions.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {dim.suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
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
            {(assessment.reportIntro || assessment.features) && (
              <div className="border-b border-border bg-primary/5 p-5">
                <h3 className="mb-2 text-sm font-semibold text-primary">测评说明</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {assessment.reportIntro || assessment.features}
                </p>
              </div>
            )}
            <div className="relative aspect-[16/9]">
              <Image
                src={result.image}
                alt={result.title}
                fill
                className="object-cover"
                sizes="600px"
              />
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

        <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{assessment.disclaimer || "测评结果仅供参考，不能替代专业诊断。"} · 连心心理</span>
        </div>
      </div>

      {showActions && (
        <div className="mt-6 flex flex-wrap gap-3 no-print">
          {result.type === "match" && (
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              复制分享文案
            </Button>
          )}
          <Button variant="outline" onClick={() => beginAssessment(assessment.id, type)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重新测试
          </Button>
          <Link href="/assessment/reports">
            <Button variant="outline">我的报告</Button>
          </Link>
          <Link href={`/assessment/${type}`}>
            <Button variant="outline">返回列表</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
