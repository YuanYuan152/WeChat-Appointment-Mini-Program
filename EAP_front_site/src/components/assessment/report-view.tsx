"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Share2, RotateCcw, AlertCircle, Download, Loader2 } from "lucide-react";
import { AssessmentImage } from "@/components/assessment/assessment-image";
import { AssessmentShareButton } from "@/components/assessment/assessment-share-button";
import { Button } from "@/components/ui/button";
import { useBeginAssessment } from "@/components/assessment/start-assessment-button";
import { downloadAssessmentReportPdf } from "@/lib/assessment/download-report-pdf";
import { DimensionRadar } from "@/components/assessment/report-score-visuals";
import {
  DimensionBars,
  DimensionDetail,
  HeroScoreCard,
  MatchMap,
  QuadrantChart,
} from "@/components/assessment/report-visual-blocks";
import {
  buildReportVisualModel,
  type ReportVisualModel,
  type VisualScore,
} from "@/lib/assessment/report-visual-model";
import type { Assessment, AssessmentScoreResult, DimensionScoreItem } from "@/lib/api/types";

interface ReportViewProps {
  assessment: Assessment;
  result: AssessmentScoreResult;
  type: "professional" | "fun";
  showActions?: boolean;
  inviteAssessment?: Assessment;
}

function IntroCard({ text }: { text: string }) {
  if (!text) {
    return null;
  }
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="mb-2 text-sm font-semibold text-primary">测评说明</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function radarItem(item: VisualScore): DimensionScoreItem {
  return {
    id: item.id,
    title: item.label,
    score: item.score,
    level: item.level,
    description: item.description,
    suggestions: item.suggestions,
  };
}

function ProfileSections({ model }: { model: ReportVisualModel }) {
  const radarById = useMemo(
    () => new Map(model.radar.map((item) => [item.id, item])),
    [model.radar],
  );
  const radarDimensions = useMemo(() => model.radar.map(radarItem), [model.radar]);
  return (
    <>
      {model.hero ? (
        <HeroScoreCard
          caption={model.hero.id === "total" ? "总分" : "综合得分"}
          eyebrow="整体结果"
          item={model.hero}
        />
      ) : null}

      {model.summary ? (
        <div className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="mb-2 font-serif text-sm font-semibold">结果概览</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{model.summary}</p>
        </div>
      ) : null}

      {model.quadrants.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {model.quadrants.map((quadrant) => (
            <QuadrantChart key={quadrant.id} quadrant={quadrant} />
          ))}
        </div>
      ) : null}

      {model.overview === "radar" ? (
        <DimensionRadar
          dimensions={radarDimensions}
          getMax={(id) => radarById.get(id)?.max ?? 1}
          getMin={(id) => radarById.get(id)?.min ?? 0}
          getRanges={(id) =>
            radarById.get(id)?.bands.map((band) => ({
              min: band.min,
              max: band.max,
              level: band.level,
              suggestions: [],
            }))
          }
        />
      ) : null}
      {model.overview === "bars" ? <DimensionBars items={model.bars} /> : null}

      {model.groups.map((group, index) => (
        <section key={`${group.title}-${index}`} className="space-y-4">
          {group.title ? (
            <div className="flex items-center gap-3 pt-2">
              <span className="h-px flex-1 bg-border" />
              <h3 className="font-serif text-sm font-semibold text-muted-foreground">{group.title}</h3>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
          {group.items.map((item) => (
            <DimensionDetail key={item.id} item={item} />
          ))}
        </section>
      ))}
    </>
  );
}

function MatchSections({ model, intro }: { model: ReportVisualModel; intro: string }) {
  const match = model.match;
  if (!match) {
    return null;
  }
  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
        <div className="relative aspect-[16/9] bg-muted">
          {match.image ? (
            <AssessmentImage alt={match.title} className="object-cover" sizes="600px" source={match.image} />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-sm opacity-80">你的结果是</p>
            <h2 className="font-serif text-3xl font-bold">{match.title}</h2>
          </div>
        </div>
        <div className="space-y-5 p-6">
          {match.description ? (
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{match.description}</p>
          ) : null}
          {match.suggestions.length ? (
            <div>
              <h3 className="mb-3 font-serif font-semibold">建议</h3>
              <ul className="space-y-2">
                {match.suggestions.map((suggestion, index) => (
                  <li key={`${index}-${suggestion}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary/15 text-[11px] font-semibold text-secondary">
                      {index + 1}
                    </span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {match.shareText ? (
            <p className="rounded-xl bg-muted p-4 text-sm italic text-muted-foreground">「{match.shareText}」</p>
          ) : null}
        </div>
      </div>
      {match.map ? <MatchMap map={match.map} /> : null}
      <IntroCard text={intro} />
    </>
  );
}

export function ReportView({
  assessment,
  result,
  type,
  showActions = true,
  inviteAssessment,
}: ReportViewProps) {
  const beginAssessment = useBeginAssessment();
  const [downloading, setDownloading] = useState(false);
  const model = useMemo(() => buildReportVisualModel(assessment, result), [assessment, result]);
  const intro = (assessment.reportIntro || assessment.features || "").trim();

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

        {model.kind === "match" ? (
          <MatchSections intro={intro} model={model} />
        ) : (
          <>
            <IntroCard text={intro} />
            {model.kind === "score" && model.hero ? (
              <HeroScoreCard caption="测评得分" item={model.hero} />
            ) : (
              <ProfileSections model={model} />
            )}
          </>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{assessment.disclaimer || "测评结果仅供参考，不能替代专业诊断。"} · 连心心理</span>
        </div>
      </div>

      {showActions && (
        <div className="mt-6 flex flex-wrap gap-3 no-print">
          {inviteAssessment?.shareUrl ? (
            <AssessmentShareButton
              assessment={inviteAssessment}
              triggerLabel="邀请好友测评"
              triggerSize="default"
            />
          ) : null}
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
