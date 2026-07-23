import { Badge, MiniStat } from "@/components/ui";
import {
  getAssessmentRangeMax,
  getScoreRangeBounds,
  mapAssessmentAnswers,
  mapDemographicAnswers,
  resolveAssessmentAssetUrl,
} from "@/lib/assessmentReport";
import { formatUtcFullDateTime } from "@/lib/format";
import type {
  AssessmentReportDetail,
  AssessmentScoreResult,
  DimensionAssessmentScoreItem,
  EapAssessmentReportDetail,
  LegacyAssessmentReportDetail,
} from "@/types/assessmentReport";
import type {
  AssessmentDefinition,
  AssessmentScoreRange,
} from "@/types/assessment";

export function AssessmentReportView({
  detail,
}: {
  detail: AssessmentReportDetail;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <ReportMeta detail={detail} />
      {detail.source === "eap" ? (
        <EapReport detail={detail} />
      ) : (
        <LegacyReport detail={detail} />
      )}
    </div>
  );
}

function ReportMeta({ detail }: { detail: AssessmentReportDetail }) {
  const subtitle =
    detail.source === "eap"
      ? detail.reportSnapshot.reportContent.subtitle ||
        detail.reportSnapshot.assessment.subtitle
      : "";
  return (
    <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--lxxl-muted)]">测评报告</p>
          <h4 className="mt-1 text-xl font-semibold">{detail.assessmentTitle}</h4>
          {subtitle && (
            <p className="mt-1 text-sm leading-6 text-[var(--lxxl-muted)]">
              {subtitle}
            </p>
          )}
          <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
            {detail.patientName}
            {detail.patientMobile ? ` · ${detail.patientMobile}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={detail.source === "eap" ? "green" : "gold"}>
            {detail.source === "eap" ? "EAP 量表" : "小程序历史量表"}
          </Badge>
          <Badge>
            {detail.category === "professional" ? "专业量表" : "趣味量表"}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat label="量表 ID" value={detail.assessmentId} />
        <MiniStat
          label="报告版本"
          value={
            detail.assessmentVersion
              ? `v${detail.assessmentVersion}`
              : "历史量表"
          }
        />
        <MiniStat
          label="完成时间"
          value={formatUtcFullDateTime(detail.completedAt)}
        />
      </div>
    </section>
  );
}

function EapReport({ detail }: { detail: EapAssessmentReportDetail }) {
  const { assessment, result } = detail.reportSnapshot;
  const intro =
    detail.reportSnapshot.reportContent.reportIntro ||
    detail.reportSnapshot.reportContent.features ||
    assessment.reportIntro ||
    assessment.features;

  return (
    <>
      {intro && (
        <section className="rounded-2xl border border-[#CFE0D7] bg-[#F1F7F3] p-5">
          <h5 className="text-sm font-semibold text-[var(--lxxl-green-dark)]">
            测评说明
          </h5>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[var(--lxxl-muted)]">
            {intro}
          </p>
        </section>
      )}
      <ScoreResult assessment={assessment} result={result} />
      <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5">
        <div className="flex items-start gap-3 text-sm leading-6 text-[var(--lxxl-muted)]">
          <span
            aria-hidden="true"
            className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#F4F1EB] text-xs"
          >
            !
          </span>
          <span>
            {detail.reportSnapshot.reportContent.disclaimer ||
              assessment.disclaimer ||
              "测评结果仅供参考，不能替代专业诊断。"}
          </span>
        </div>
      </section>
      <RawAnswerSection detail={detail} />
    </>
  );
}

function ScoreResult({
  assessment,
  result,
}: {
  assessment: AssessmentDefinition;
  result: AssessmentScoreResult;
}) {
  switch (result.type) {
    case "sum":
      return (
        <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-6">
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <ScoreRing
              label="测评得分"
              level={result.level}
              max={getAssessmentRangeMax(assessment.scoreRanges)}
              score={result.totalScore}
            />
            <div>
              <ResultText
                description={result.description}
                suggestions={result.suggestions}
              />
              {assessment.scoreRanges?.length ? (
                <RangeReference ranges={assessment.scoreRanges} />
              ) : null}
            </div>
          </div>
        </section>
      );
    case "dimension":
      return (
        <div className="space-y-4">
          {result.summary && (
            <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5 text-center text-sm leading-7 text-[var(--lxxl-muted)]">
              {result.summary}
            </section>
          )}
          <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5">
            <h5 className="font-semibold">维度结果</h5>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {result.dimensions.map((dimension) => (
                <DimensionResult
                  assessment={assessment}
                  dimension={dimension}
                  key={dimension.id}
                />
              ))}
            </div>
          </section>
        </div>
      );
    case "match": {
      const imageUrl = resolveAssessmentAssetUrl(
        result.image,
        process.env.NEXT_PUBLIC_EAP_BASE_URL,
      );
      return (
        <section className="overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white">
          {imageUrl && (
            <div
              aria-label={result.title}
              className="aspect-[16/7] w-full bg-[#F4F1EB] bg-cover bg-center"
              role="img"
              style={{ backgroundImage: `url("${imageUrl}")` }}
            />
          )}
          <div className="p-6">
            <p className="text-xs text-[var(--lxxl-muted)]">匹配结果</p>
            <h5 className="mt-1 text-2xl font-semibold">{result.title}</h5>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--lxxl-muted)]">
              {result.description}
            </p>
            {result.shareText && (
              <p className="mt-4 rounded-xl bg-[#FAF8F4] p-4 text-sm leading-6 text-[var(--lxxl-muted)]">
                {result.shareText}
              </p>
            )}
          </div>
        </section>
      );
    }
  }
}

function ScoreRing({
  score,
  max,
  level,
  label,
}: {
  score: number;
  max: number;
  level: string;
  label: string;
}) {
  const percentage =
    max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-center">
      <div
        className="grid h-40 w-40 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--lxxl-green) ${percentage}%, #ECE8E0 ${percentage}% 100%)`,
        }}
      >
        <div className="grid h-[132px] w-[132px] place-items-center rounded-full bg-white text-center">
          <div>
            <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
            <div className="mt-1 text-4xl font-semibold text-[var(--lxxl-green-dark)]">
              {score}
            </div>
            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">/ {max}</div>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Badge tone="green">{level}</Badge>
      </div>
    </div>
  );
}

function ResultText({
  description,
  suggestions,
}: {
  description: string;
  suggestions: string[];
}) {
  return (
    <div>
      <h5 className="font-semibold">结果解读</h5>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[var(--lxxl-muted)]">
        {description || "暂无结果解读"}
      </p>
      {suggestions.length > 0 && (
        <div className="mt-5">
          <h5 className="font-semibold">建议</h5>
          <ul className="mt-2 space-y-2">
            {suggestions.map((suggestion, index) => (
              <li
                className="flex items-start gap-2 text-sm leading-6 text-[var(--lxxl-muted)]"
                key={`${index}-${suggestion}`}
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lxxl-green)]" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RangeReference({ ranges }: { ranges: AssessmentScoreRange[] }) {
  return (
    <div className="mt-6 border-t border-[var(--lxxl-border)] pt-4">
      <h5 className="text-sm font-semibold">得分区间参考</h5>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ranges.map((range) => (
          <div
            className="rounded-xl bg-[#FAF8F4] px-3 py-2 text-xs leading-5 text-[var(--lxxl-muted)]"
            key={`${range.level}-${range.min}-${range.max}`}
          >
            <span className="font-medium text-[var(--lxxl-text)]">
              {range.level}
            </span>
            <span className="ml-2">
              {range.min}–{range.max} 分
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionResult({
  assessment,
  dimension,
}: {
  assessment: AssessmentDefinition;
  dimension: DimensionAssessmentScoreItem;
}) {
  const definition = assessment.dimensions?.find(
    (item) => item.id === dimension.id,
  );
  const { min, max } = getScoreRangeBounds(definition?.scoreRanges);
  const span = Math.max(1, max - min);
  const percentage =
    Math.min(100, Math.max(0, ((dimension.score - min) / span) * 100));

  return (
    <article className="rounded-xl border border-[var(--lxxl-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h6 className="font-medium">{dimension.title}</h6>
          <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
            {dimension.score} 分 · 区间 {min}–{max}
          </p>
        </div>
        <Badge tone="green">{dimension.level}</Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECE8E0]">
        <div
          className="h-full rounded-full bg-[var(--lxxl-green)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {definition?.intro && (
        <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs leading-6 text-[var(--lxxl-muted)]">
          {definition.intro}
        </p>
      )}
      <div className="mt-4">
        <ResultText
          description={dimension.description}
          suggestions={dimension.suggestions}
        />
      </div>
    </article>
  );
}

function RawAnswerSection({
  detail,
}: {
  detail: EapAssessmentReportDetail;
}) {
  const canViewRaw =
    detail.answers !== undefined || detail.demographicAnswers !== undefined;
  const answerRows = detail.answers
    ? mapAssessmentAnswers(detail.reportSnapshot.assessment, detail.answers)
    : [];
  const demographicRows = detail.demographicAnswers
    ? mapDemographicAnswers(
        detail.reportSnapshot.assessment,
        detail.demographicAnswers,
      )
    : [];

  return (
    <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--lxxl-text)]">
          敏感原始数据
        </summary>
        {!canViewRaw ? (
          <p className="mt-4 rounded-xl bg-[#FAF8F4] p-4 text-sm leading-6 text-[var(--lxxl-muted)]">
            当前权限仅可查看报告结果，不能查看人口学信息和逐题答案。
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            <RawRows title="人口学信息" rows={demographicRows} />
            <RawRows title="逐题答案" rows={answerRows} />
          </div>
        )}
      </details>
    </section>
  );
}

function RawRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; label: string; value: string }>;
}) {
  return (
    <div>
      <h6 className="text-sm font-medium">{title}</h6>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--lxxl-muted)]">暂无数据</p>
      ) : (
        <dl className="mt-2 divide-y divide-[var(--lxxl-border)] border-y border-[var(--lxxl-border)]">
          {rows.map((row) => (
            <div
              className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:gap-4"
              key={row.id}
            >
              <dt className="text-[var(--lxxl-muted)]">{row.label}</dt>
              <dd className="font-medium sm:text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function LegacyReport({
  detail,
}: {
  detail: LegacyAssessmentReportDetail;
}) {
  const { result } = detail;
  return (
    <>
      <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-6">
        <div className="rounded-xl border border-[#E7D3A8] bg-[#FFF9EC] px-4 py-3 text-sm leading-6 text-[#7A5C22]">
          这是小程序历史量表记录，不包含 EAP 版本化报告快照。
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <ScoreRing
            label="测评得分"
            level={result.levelLabel}
            max={legacyScoreMax(result.scaleType)}
            score={result.total}
          />
          <ResultText
            description={result.description}
            suggestions={result.suggestions}
          />
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--lxxl-border)] bg-white p-5">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            敏感原始数据
          </summary>
          {result.answers ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {result.answers.map((score, index) => (
                <div
                  className="rounded-xl bg-[#FAF8F4] px-3 py-2 text-sm"
                  key={`${index}-${score}`}
                >
                  <span className="text-[var(--lxxl-muted)]">
                    第 {index + 1} 题
                  </span>
                  <span className="ml-2 font-medium">{score} 分</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-[#FAF8F4] p-4 text-sm leading-6 text-[var(--lxxl-muted)]">
              当前权限仅可查看报告结果，不能查看逐题答案。
            </p>
          )}
        </details>
      </section>
    </>
  );
}

function legacyScoreMax(scaleType: string) {
  return scaleType.toUpperCase().replace("-", "") === "PHQ9" ? 27 : 21;
}
