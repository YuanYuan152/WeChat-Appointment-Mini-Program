"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  bandForScore,
  formatVisualScore,
  type VisualBand,
  type VisualMatch,
  type VisualQuadrant,
  type VisualScore,
  type VisualTone,
} from "@/lib/assessment/report-visual-model";

/** 结果色调：贴合站点暖色系（主色赤陶、辅色鼠尾草绿）。 */
export const EAP_TONES: Record<VisualTone, { color: string; soft: string; text: string }> = {
  good: { color: "#5E9468", soft: "rgba(94,148,104,0.14)", text: "#3F6E49" },
  mild: { color: "#CC9A2B", soft: "rgba(204,154,43,0.16)", text: "#8A6512" },
  moderate: { color: "#D46F43", soft: "rgba(212,111,67,0.15)", text: "#A24B26" },
  severe: { color: "#BF4B45", soft: "rgba(191,75,69,0.14)", text: "#9A322D" },
  neutral: { color: "#c4795a", soft: "rgba(196,121,90,0.14)", text: "#9A5A3F" },
};

export function LevelPill({
  tone,
  children,
  className,
}: {
  tone: VisualTone;
  children: ReactNode;
  className?: string;
}) {
  const palette = EAP_TONES[tone];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", className)}
      style={{ background: palette.soft, color: palette.text }}
    >
      {children}
    </span>
  );
}

function rangeText(band: VisualBand) {
  return band.min === band.max
    ? formatVisualScore(band.min)
    : `${formatVisualScore(band.min)}–${formatVisualScore(band.max)}`;
}

/** 当前得分所处区间的一句话说明。 */
export function bandSentence(item: VisualScore): string {
  const band = bandForScore(item.score, item.bands);
  if (!band || item.bands.length < 2) {
    return "";
  }
  return `处于「${band.level}」区间（${rangeText(band)} 分）`;
}

function polar(cx: number, cy: number, radius: number, ratio: number) {
  const angle = Math.PI - ratio * Math.PI;
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number) {
  const start = polar(cx, cy, radius, from);
  const end = polar(cx, cy, radius, to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** 区间在 min..max 上占据的比例（连续分段，避免整数区间之间留缝）。 */
function bandSpans(item: VisualScore) {
  const span = item.max - item.min || 1;
  return item.bands.map((band, index) => {
    const next = item.bands[index + 1];
    const start = Math.min(1, Math.max(0, (band.min - item.min) / span));
    const endValue = next ? next.min : item.max;
    const end = Math.min(1, Math.max(start, (endValue - item.min) / span));
    return { band, start, end };
  });
}

/** 半圆仪表：外圈按区间分段着色，内圈为得分进度，圆点指向当前分数。 */
export function ScoreGauge({ item, caption }: { item: VisualScore; caption: string }) {
  const width = 280;
  const height = 168;
  const cx = width / 2;
  const cy = 146;
  const outer = 118;
  const inner = 98;
  const palette = EAP_TONES[item.tone];
  const spans = bandSpans(item);
  const marker = polar(cx, cy, inner, item.ratio);

  return (
    <div className="flex flex-col items-center">
      <svg
        aria-label={`${caption} ${formatVisualScore(item.score)} 分，满分 ${formatVisualScore(item.max)} 分`}
        className="h-auto w-full max-w-[300px]"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {spans.length > 1 ? (
          spans.map(({ band, start, end }) => (
            <path
              key={`${band.min}-${band.max}`}
              d={arcPath(cx, cy, outer, start + 0.004, Math.max(start + 0.004, end - 0.004))}
              fill="none"
              stroke={EAP_TONES[band.tone].color}
              strokeLinecap="butt"
              strokeOpacity={bandForScore(item.score, item.bands) === band ? 0.95 : 0.35}
              strokeWidth={8}
            />
          ))
        ) : (
          <path d={arcPath(cx, cy, outer, 0, 1)} fill="none" stroke="var(--border)" strokeWidth={8} />
        )}
        <path
          d={arcPath(cx, cy, inner, 0, 1)}
          fill="none"
          stroke="var(--muted)"
          strokeLinecap="round"
          strokeWidth={14}
        />
        {item.ratio > 0 && (
          <motion.path
            animate={{ pathLength: 1 }}
            d={arcPath(cx, cy, inner, 0, item.ratio)}
            fill="none"
            initial={{ pathLength: 0 }}
            stroke={palette.color}
            strokeLinecap="round"
            strokeWidth={14}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
        <motion.circle
          animate={{ opacity: 1, scale: 1 }}
          cx={marker.x}
          cy={marker.y}
          fill="var(--card)"
          initial={{ opacity: 0, scale: 0.4 }}
          r={9}
          stroke={palette.color}
          strokeWidth={4}
          transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 18 }}
        />
        <text className="fill-muted-foreground" fontSize={11} textAnchor="middle" x={cx - inner} y={cy + 18}>
          {formatVisualScore(item.min)}
        </text>
        <text className="fill-muted-foreground" fontSize={11} textAnchor="middle" x={cx + inner} y={cy + 18}>
          {formatVisualScore(item.max)}
        </text>
        <text className="fill-muted-foreground" fontSize={12} textAnchor="middle" x={cx} y={cy - 58}>
          {caption}
        </text>
        <text
          fill={palette.text}
          fontFamily="var(--font-noto-serif, serif)"
          fontSize={44}
          fontWeight={700}
          textAnchor="middle"
          x={cx}
          y={cy - 12}
        >
          {formatVisualScore(item.score)}
        </text>
        <text className="fill-muted-foreground" fontSize={11} textAnchor="middle" x={cx} y={cy + 6}>
          满分 {formatVisualScore(item.max)}
        </text>
      </svg>
      {item.level ? <LevelPill tone={item.tone}>{item.level}</LevelPill> : null}
    </div>
  );
}

/** 横向区间刻度：分段色带 + 当前位置 + 参考界值。 */
export function BandScale({ item }: { item: VisualScore }) {
  const spans = bandSpans(item);
  const palette = EAP_TONES[item.tone];
  const active = bandForScore(item.score, item.bands);
  const span = item.max - item.min || 1;
  return (
    <div className="space-y-2">
      <div className="relative pt-3">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {spans.length > 1 ? (
            spans.map(({ band, start, end }) => (
              <div
                key={`${band.min}-${band.max}`}
                className="absolute top-0 h-full"
                style={{
                  left: `${start * 100}%`,
                  width: `${Math.max(0, end - start) * 100}%`,
                  background: EAP_TONES[band.tone].color,
                  opacity: band === active ? 0.95 : 0.28,
                  borderRight: "2px solid var(--card)",
                }}
              />
            ))
          ) : (
            <motion.div
              animate={{ width: `${item.ratio * 100}%` }}
              className="h-full rounded-full"
              initial={{ width: 0 }}
              style={{ background: palette.color }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
          {item.markers.map((marker) => (
            <div
              key={marker.label}
              className="absolute top-0 h-full w-0.5 bg-foreground/45"
              style={{ left: `${Math.min(100, Math.max(0, ((marker.value - item.min) / span) * 100))}%` }}
              title={marker.label}
            />
          ))}
        </div>
        <motion.div
          animate={{ left: `${item.ratio * 100}%`, opacity: 1 }}
          className="absolute top-0 -translate-x-1/2"
          initial={{ left: "0%", opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div
            className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent"
            style={{ borderTopColor: palette.color }}
          />
        </motion.div>
      </div>
      {spans.length > 1 ? (
        <div className="relative h-9 text-[10px] leading-tight text-muted-foreground">
          {spans.map(({ band, start, end }) => {
            const width = end - start;
            return (
              <div
                key={`${band.level}-${band.min}`}
                className={cn("absolute top-0 overflow-hidden px-0.5 text-center", band === active && "font-semibold")}
                style={{
                  left: `${start * 100}%`,
                  width: `${width * 100}%`,
                  color: band === active ? EAP_TONES[band.tone].text : undefined,
                }}
                title={`${band.level} ${rangeText(band)}`}
              >
                <div className="truncate">{band.level}</div>
                {width >= 0.12 ? <div className="truncate tabular-nums opacity-80">{rangeText(band)}</div> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{formatVisualScore(item.min)}</span>
          <span>{formatVisualScore(item.max)}</span>
        </div>
      )}
      {item.markers.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {item.markers.map((marker) => marker.label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function SuggestionList({ items }: { items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <ul className="space-y-2">
      {items.map((suggestion, index) => (
        <li key={`${index}-${suggestion}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary/15 text-[11px] font-semibold text-secondary">
            {index + 1}
          </span>
          <span>{suggestion}</span>
        </li>
      ))}
    </ul>
  );
}

/** 总分 / 求和得分主卡片：仪表 + 区间刻度 + 解读 + 建议。 */
export function HeroScoreCard({
  item,
  caption,
  eyebrow,
}: {
  item: VisualScore;
  caption: string;
  eyebrow?: string;
}) {
  const sentence = bandSentence(item);
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-center">
        <ScoreGauge caption={caption} item={item} />
        <div className="min-w-0 space-y-4">
          <div>
            {eyebrow ? <p className="text-xs tracking-wide text-muted-foreground">{eyebrow}</p> : null}
            <h2 className="mt-1 font-serif text-xl font-bold">{item.title}</h2>
            {sentence ? <p className="mt-1 text-sm text-muted-foreground">{sentence}</p> : null}
          </div>
          {item.bands.length > 1 || item.markers.length > 0 ? <BandScale item={item} /> : null}
          {item.intro ? (
            <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">{item.intro}</p>
          ) : null}
        </div>
      </div>
      {item.description || item.suggestions.length ? (
        <div className="space-y-5 border-t border-border bg-background/60 px-6 py-6 sm:px-8">
          {item.description ? (
            <div>
              <h3 className="mb-2 font-serif font-semibold">结果解读</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          ) : null}
          {item.suggestions.length ? (
            <div>
              <h3 className="mb-3 font-serif font-semibold">建议</h3>
              <SuggestionList items={item.suggestions} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** 维度条形对比：维度较少，或像 CBCL 这样需要看参考界值时使用。 */
export function DimensionBars({ items, title = "维度对比" }: { items: VisualScore[]; title?: string }) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h3 className="font-serif text-sm font-semibold tracking-wide">{title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">条形长度为得分在该维度满分中的位置，竖线为参考界值</p>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => {
          const palette = EAP_TONES[item.tone];
          const span = item.max - item.min || 1;
          return (
            <a
              key={item.id}
              className="group block rounded-xl px-1 py-1 transition hover:bg-muted/40"
              href={`#dimension-${item.id}`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium group-hover:text-primary">{item.label}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    <b className="font-serif text-base" style={{ color: palette.text }}>
                      {formatVisualScore(item.score)}
                    </b>
                    {" / "}
                    {formatVisualScore(item.max)}
                  </span>
                  {item.level ? <LevelPill className="px-2 py-0.5" tone={item.tone}>{item.level}</LevelPill> : null}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  animate={{ width: `${Math.max(item.ratio * 100, item.score > item.min ? 2 : 0)}%` }}
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  style={{ background: palette.color }}
                  transition={{ duration: 0.7, delay: index * 0.05, ease: "easeOut" }}
                />
                {item.markers.map((marker) => (
                  <span
                    key={marker.label}
                    className="absolute top-0 h-full w-0.5 bg-foreground/50"
                    style={{ left: `${Math.min(100, Math.max(0, ((marker.value - item.min) / span) * 100))}%` }}
                    title={marker.label}
                  />
                ))}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/** 二维象限（PBI：关爱 × 控制）。 */
export function QuadrantChart({ quadrant }: { quadrant: VisualQuadrant }) {
  const size = 240;
  const pad = 30;
  const plot = size - pad * 2;
  const xAt = (value: number) =>
    pad + (Math.min(quadrant.x.max, Math.max(quadrant.x.min, value)) - quadrant.x.min) / (quadrant.x.max - quadrant.x.min) * plot;
  const yAt = (value: number) =>
    size - pad - (Math.min(quadrant.y.max, Math.max(quadrant.y.min, value)) - quadrant.y.min) / (quadrant.y.max - quadrant.y.min) * plot;
  const point = { x: xAt(quadrant.x.score), y: yAt(quadrant.y.score) };
  const labels = [
    { text: quadrant.cells.lowHigh, x: pad + 6, y: pad + 14, anchor: "start" as const },
    { text: quadrant.cells.highHigh, x: size - pad - 6, y: pad + 14, anchor: "end" as const },
    { text: quadrant.cells.lowLow, x: pad + 6, y: size - pad - 8, anchor: "start" as const },
    { text: quadrant.cells.highLow, x: size - pad - 6, y: size - pad - 8, anchor: "end" as const },
  ];
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-sm font-semibold">{quadrant.title}</h3>
        <LevelPill tone="neutral">{quadrant.result}</LevelPill>
      </div>
      <svg aria-label={`${quadrant.title}：${quadrant.result}`} className="mx-auto mt-3 h-auto w-full max-w-[260px]" role="img" viewBox={`0 0 ${size} ${size}`}>
        <rect fill="var(--background)" height={plot} rx={10} stroke="var(--border)" width={plot} x={pad} y={pad} />
        <line stroke="var(--primary)" strokeDasharray="4 4" strokeOpacity={0.6} x1={xAt(quadrant.x.high)} x2={xAt(quadrant.x.high)} y1={pad} y2={size - pad} />
        <line stroke="var(--primary)" strokeDasharray="4 4" strokeOpacity={0.6} x1={pad} x2={size - pad} y1={yAt(quadrant.y.high)} y2={yAt(quadrant.y.high)} />
        <line stroke="var(--muted-foreground)" strokeDasharray="2 4" strokeOpacity={0.45} x1={xAt(quadrant.x.low)} x2={xAt(quadrant.x.low)} y1={pad} y2={size - pad} />
        <line stroke="var(--muted-foreground)" strokeDasharray="2 4" strokeOpacity={0.45} x1={pad} x2={size - pad} y1={yAt(quadrant.y.low)} y2={yAt(quadrant.y.low)} />
        {labels.map((label) => (
          <text
            key={label.text}
            className={label.text === quadrant.result ? "fill-primary" : "fill-muted-foreground"}
            fontSize={12}
            fontWeight={label.text === quadrant.result ? 700 : 400}
            textAnchor={label.anchor}
            x={label.x}
            y={label.y}
          >
            {label.text}
          </text>
        ))}
        <circle cx={point.x} cy={point.y} fill="var(--primary)" opacity={0.16} r={13} />
        <motion.circle
          animate={{ opacity: 1, scale: 1 }}
          cx={point.x}
          cy={point.y}
          fill="var(--primary)"
          initial={{ opacity: 0, scale: 0.4 }}
          r={6}
          stroke="var(--card)"
          strokeWidth={2}
          transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 18 }}
        />
        <text className="fill-muted-foreground" fontSize={11} textAnchor="middle" x={size / 2} y={size - 8}>
          {quadrant.x.label} {formatVisualScore(quadrant.x.score)} / {quadrant.x.max} →
        </text>
        <text className="fill-muted-foreground" fontSize={11} textAnchor="middle" transform={`rotate(-90 12 ${size / 2})`} x={12} y={size / 2}>
          {quadrant.y.label} {formatVisualScore(quadrant.y.score)} / {quadrant.y.max} →
        </text>
      </svg>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">虚线为高分界值，点线为低分界值</p>
    </div>
  );
}

/** AAS 依恋类型：亲近 × 焦虑 的 2×2 示意。 */
export function MatchMap({ map }: { map: NonNullable<VisualMatch["map"]> }) {
  const ordered = [...map.cells].sort((left, right) => right.row - left.row || left.column - right.column);
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="font-serif text-sm font-semibold">类型位置</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">横向为{map.xLabel}，纵向为{map.yLabel}</p>
      <div className="mt-4 flex gap-3">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="whitespace-nowrap text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            {map.yLabel} 低 → 高
          </span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-2">
            {ordered.map((cell) => (
              <div
                key={cell.id}
                className={cn(
                  "relative flex min-h-[84px] flex-col items-center justify-center rounded-xl border text-center transition",
                  cell.active ? "border-primary bg-primary/10" : "border-border bg-background/70",
                )}
              >
                <span className={cn("font-serif text-base", cell.active ? "font-bold text-primary" : "text-muted-foreground")}>
                  {cell.title}
                </span>
                {cell.active ? (
                  <span className="mt-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">你的类型</span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{map.xLabel} 低 → 高</p>
        </div>
      </div>
    </section>
  );
}

/** 维度详情卡片，子维度嵌套展示。 */
export function DimensionDetail({ item, depth = 0 }: { item: VisualScore; depth?: number }) {
  const palette = EAP_TONES[item.tone];
  const sentence = bandSentence(item);
  return (
    <div
      className={cn(
        "scroll-mt-24 rounded-[var(--radius)] border bg-card shadow-sm",
        depth > 0 ? "border-border/80 p-4 shadow-none" : "border-border p-5 sm:p-6",
      )}
      id={`dimension-${item.id}`}
      style={{ boxShadow: depth > 0 ? `inset 3px 0 0 ${palette.color}` : undefined }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {depth > 0 ? <p className="mb-0.5 text-[11px] text-muted-foreground">子维度</p> : null}
          <h3 className={cn("font-serif font-semibold tracking-tight", depth > 0 ? "text-base" : "text-lg")}>{item.title}</h3>
          {sentence ? <p className="mt-1 text-xs text-muted-foreground">{sentence}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-serif text-3xl font-semibold leading-none tabular-nums" style={{ color: palette.text }}>
            {formatVisualScore(item.score)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">/ {formatVisualScore(item.max)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.level ? <LevelPill tone={item.tone}>{item.level}</LevelPill> : null}
      </div>
      <div className="mt-4">
        <BandScale item={item} />
      </div>
      {item.intro ? (
        <p className="mt-4 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{item.intro}</p>
      ) : null}
      {item.description ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      ) : null}
      {item.suggestions.length ? (
        <div className="mt-4">
          <SuggestionList items={item.suggestions} />
        </div>
      ) : null}
      {item.children.length ? (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          {item.children.map((child) => (
            <DimensionDetail key={child.id} depth={depth + 1} item={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
