"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DimensionScoreItem, ScoreRange } from "@/lib/api/types";

export function getRangeMax(ranges?: ScoreRange[]): number {
  if (!ranges?.length) return 100;
  return Math.max(...ranges.map((r) => r.max));
}

export function getRangeMin(ranges?: ScoreRange[]): number {
  if (!ranges?.length) return 0;
  return Math.min(...ranges.map((r) => r.min));
}

/** 根据等级文案映射色调（偏绿→黄→橙→红） */
export function getLevelTone(level: string): {
  bar: string;
  ring: string;
  badge: string;
  text: string;
} {
  const t = level.toLowerCase();
  if (/正常|很好|良好|安全|低分|低段|优秀/.test(t)) {
    return {
      bar: "bg-emerald-500",
      ring: "#10b981",
      badge: "bg-emerald-500/10 text-emerald-700",
      text: "text-emerald-700",
    };
  }
  if (/轻度|较轻|一般|中等|中分|中段|先占|尚可|较好/.test(t)) {
    return {
      bar: "bg-amber-500",
      ring: "#f59e0b",
      badge: "bg-amber-500/10 text-amber-700",
      text: "text-amber-700",
    };
  }
  if (/中度|偏高|拒绝|恐惧|较差/.test(t)) {
    return {
      bar: "bg-orange-500",
      ring: "#f97316",
      badge: "bg-orange-500/10 text-orange-700",
      text: "text-orange-700",
    };
  }
  if (/重度|严重|高分|高段|很差|极差/.test(t)) {
    return {
      bar: "bg-rose-500",
      ring: "#f43f5e",
      badge: "bg-rose-500/10 text-rose-700",
      text: "text-rose-700",
    };
  }
  return {
    bar: "bg-primary",
    ring: "var(--primary)",
    badge: "bg-primary/10 text-primary",
    text: "text-primary",
  };
}

interface ScoreRingProps {
  score: number;
  max: number;
  level: string;
  label?: string;
  size?: number;
}

/** 总分环形图 */
export function ScoreRing({ score, max, level, label = "总分", size = 168 }: ScoreRingProps) {
  const tone = getLevelTone(level);
  const pct = max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("font-serif text-4xl font-bold", tone.text)}>{score}</p>
          <p className="text-xs text-muted-foreground">/ {max}</p>
        </div>
      </div>
      <span className={cn("mt-3 rounded-full px-4 py-1.5 text-sm font-medium", tone.badge)}>
        {level}
      </span>
    </div>
  );
}

interface DimensionBarProps {
  dim: DimensionScoreItem;
  max: number;
  min?: number;
  ranges?: ScoreRange[];
}

/** 维度横向进度条 + 区间刻度（保留给非交互场景） */
export function DimensionBar({ dim, max, min = 0, ranges }: DimensionBarProps) {
  const tone = getLevelTone(dim.level);
  const span = Math.max(1, max - min);
  const pct = Math.min(100, Math.max(0, ((dim.score - min) / span) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-serif font-semibold">{dim.title}</h3>
          <p className="text-xs text-muted-foreground">
            得分 {dim.score}
            <span className="mx-1 text-border">·</span>
            满分 {max}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", tone.badge)}>
          {dim.level}
        </span>
      </div>

      <div className="relative pt-1">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-700 ease-out", tone.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${pct}%` }}
          aria-hidden
        >
          <div className={cn("mx-auto h-4 w-0.5 rounded-full", tone.bar)} />
        </div>
      </div>

      {ranges && ranges.length > 0 ? (
        <div className="flex justify-between gap-1 text-[10px] text-muted-foreground">
          {ranges.map((r) => (
            <span key={`${r.min}-${r.max}`} className="text-center leading-tight">
              {r.min}–{r.max}
              <br />
              {r.level}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

/** 区间虚线颜色：优先按等级文案；否则按序绿→红 */
function rangeDashColor(level: string, index: number, total: number): string {
  const byLevel = getLevelTone(level).ring;
  if (byLevel !== "var(--primary)") return byLevel;
  if (total <= 1) return "#10b981";
  const t = index / Math.max(1, total - 1);
  if (t <= 0.25) return "#10b981";
  if (t <= 0.5) return "#f59e0b";
  if (t <= 0.75) return "#f97316";
  return "#f43f5e";
}

function buildBands(min: number, max: number, ranges?: ScoreRange[]): ScoreRange[] {
  const span = Math.max(1, max - min);
  const sorted = [...(ranges ?? [])].sort((a, b) => a.min - b.min);
  if (sorted.length > 0) return sorted;
  return [
    { min, max: min + span * 0.33, level: "偏低", description: "", suggestions: [] },
    { min: min + span * 0.33, max: min + span * 0.66, level: "中等", description: "", suggestions: [] },
    { min: min + span * 0.66, max, level: "偏高", description: "", suggestions: [] },
  ];
}

interface DimensionQuadrantProps {
  dim: DimensionScoreItem;
  max: number;
  min?: number;
  ranges?: ScoreRange[];
  compact?: boolean;
  hideHeader?: boolean;
  /** 不展示分数区间数值（维度总览右侧用） */
  hideRanges?: boolean;
  /** 不展示等级图例列表，仅保留纵向轴 */
  hideLegend?: boolean;
}

/**
 * 纵向位置轴（维度总览右侧）：
 * 细轴 + 彩虚线分区；当前位置用圆点，无星星
 */
export function DimensionQuadrant({
  dim,
  max,
  min = 0,
  ranges,
  compact = false,
  hideHeader = false,
  hideRanges = false,
  hideLegend = false,
}: DimensionQuadrantProps) {
  const tone = getLevelTone(dim.level);
  const span = Math.max(1, max - min);
  const scoreRatio = Math.min(1, Math.max(0, (dim.score - min) / span));
  const markerTopPct = (1 - scoreRatio) * 100;
  const bands = buildBands(min, max, ranges);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const axisH = compact ? 160 : 228;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {!hideHeader ? (
        <div
          className={cn(
            "flex gap-3",
            hideLegend
              ? "flex-col items-center text-center"
              : "items-baseline justify-between"
          )}
        >
          <div className={cn("min-w-0", hideLegend && "w-full")}>
            <h3
              className={cn(
                "font-serif font-semibold tracking-tight",
                compact ? "text-base" : "text-xl"
              )}
            >
              {dim.title}
            </h3>
            {!hideRanges ? (
              <p className="mt-1 text-[11px] tracking-wide text-muted-foreground">
                {min} — {max}
              </p>
            ) : null}
          </div>
          <div className={cn("shrink-0", hideLegend ? "text-center" : "text-right")}>
            <p
              className={cn(
                "font-serif font-semibold tabular-nums leading-none",
                tone.text,
                compact ? "text-2xl" : "text-3xl"
              )}
            >
              {dim.score}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{dim.level}</p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-stretch",
          hideLegend ? "justify-center" : compact ? "gap-4" : "gap-8"
        )}
      >
        <div
          className={cn(
            "relative shrink-0",
            hideLegend ? "mx-auto" : "mx-auto sm:mx-0",
            compact ? "w-10" : "w-14"
          )}
          style={{ height: axisH }}
          onMouseLeave={() => setHoverKey(null)}
        >
          <div
            className="absolute bottom-0 left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full opacity-90"
            style={{
              background:
                "linear-gradient(to top, #10b981 0%, #84cc16 28%, #f59e0b 58%, #f97316 78%, #f43f5e 100%)",
            }}
          />

          {bands.map((r, i) => {
            const mid = (r.min + r.max) / 2;
            const topPct = (1 - Math.min(1, Math.max(0, (mid - min) / span))) * 100;
            const color = rangeDashColor(r.level, i, bands.length);
            const key = `${r.min}-${r.max}`;
            const active = hoverKey === key;
            const reached = dim.score >= r.min;
            return (
              <button
                key={key}
                type="button"
                className="absolute left-0 right-0 z-[1] -translate-y-1/2 border-0 bg-transparent p-0"
                style={{ top: `${topPct}%` }}
                onMouseEnter={() => setHoverKey(key)}
                onFocus={() => setHoverKey(key)}
                aria-label={`${r.level} ${r.min}-${r.max}`}
              >
                <span
                  className="mx-auto block h-px border-t border-dashed transition-all duration-200"
                  style={{
                    borderColor: color,
                    opacity: active || reached ? 1 : 0.35,
                    width: active ? (compact ? 32 : 44) : compact ? 26 : 36,
                  }}
                />
              </button>
            );
          })}

          <motion.div
            className="absolute left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${markerTopPct}%` }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.12 }}
          >
            <span
              className={cn(
                "block rounded-full border-2 border-card shadow-sm",
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              style={{ background: tone.ring === "var(--primary)" ? "var(--primary)" : tone.ring }}
            />
          </motion.div>
        </div>

        {!hideLegend ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0">
            {bands.map((r, i) => {
              const color = rangeDashColor(r.level, i, bands.length);
              const key = `${r.min}-${r.max}`;
              const inRange = dim.score >= r.min && dim.score <= r.max;
              const reached = dim.score >= r.min;
              const active = hoverKey === key || inRange;
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 border-0 bg-transparent text-left transition-opacity",
                    compact ? "py-1.5" : "gap-3 py-2",
                    active ? "opacity-100" : reached ? "opacity-55" : "opacity-30 hover:opacity-70"
                  )}
                  onMouseEnter={() => setHoverKey(key)}
                  onFocus={() => setHoverKey(key)}
                >
                  <span
                    className="h-px w-4 shrink-0 border-t border-dashed"
                    style={{ borderColor: color }}
                  />
                  <span
                    className={cn(
                      "font-medium tracking-wide",
                      compact ? "text-[11px]" : "text-[12px]"
                    )}
                    style={{ color }}
                  >
                    {r.level}
                  </span>
                  {!hideRanges ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {Math.round(r.min)}–{Math.round(r.max)}
                    </span>
                  ) : null}
                  {inRange ? (
                    <span className="ml-auto text-[10px] tracking-wide text-muted-foreground">
                      当前
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface DimensionAxisHorizontalProps {
  dim: DimensionScoreItem;
  max: number;
  min?: number;
  ranges?: ScoreRange[];
}

/**
 * 横向位置轴（各维度详情块）：
 * 横轴 + 纵向虚线刻度标示程度；当前位置用圆点，无星星
 */
export function DimensionAxisHorizontal({
  dim,
  max,
  min = 0,
  ranges,
}: DimensionAxisHorizontalProps) {
  const tone = getLevelTone(dim.level);
  const span = Math.max(1, max - min);
  const scoreRatio = Math.min(1, Math.max(0, (dim.score - min) / span));
  const markerLeftPct = scoreRatio * 100;
  const bands = buildBands(min, max, ranges);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-semibold tracking-tight">{dim.title}</h3>
          <p className="mt-1 text-[11px] tracking-wide text-muted-foreground">
            {min} — {max}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-serif text-3xl font-semibold tabular-nums leading-none", tone.text)}>
            {dim.score}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{dim.level}</p>
        </div>
      </div>

      {/* 横向轴 */}
      <div className="relative px-1 pt-2 pb-1" onMouseLeave={() => setHoverKey(null)}>
        <div
          className="relative h-[3px] w-full rounded-full"
          style={{
            background:
              "linear-gradient(to right, #10b981 0%, #84cc16 28%, #f59e0b 58%, #f97316 78%, #f43f5e 100%)",
          }}
        >
          {/* 程度虚线（竖向虚线刻在轴上） */}
          {bands.map((r, i) => {
            const mid = (r.min + r.max) / 2;
            const leftPct = Math.min(100, Math.max(0, ((mid - min) / span) * 100));
            const color = rangeDashColor(r.level, i, bands.length);
            const key = `${r.min}-${r.max}`;
            const active = hoverKey === key;
            const reached = dim.score >= r.min;
            return (
              <button
                key={key}
                type="button"
                className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0"
                style={{ left: `${leftPct}%` }}
                onMouseEnter={() => setHoverKey(key)}
                onFocus={() => setHoverKey(key)}
                aria-label={`${r.level} ${r.min}-${r.max}`}
              >
                <span
                  className="block w-px border-l border-dashed transition-all duration-200"
                  style={{
                    borderColor: color,
                    height: active ? 28 : 20,
                    opacity: active || reached ? 1 : 0.35,
                  }}
                />
              </button>
            );
          })}

          {/* 当前位置 */}
          <motion.div
            className="absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${markerLeftPct}%` }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.1 }}
          >
            <span
              className="block h-3 w-3 rounded-full border-2 border-card shadow-sm"
              style={{ background: tone.ring === "var(--primary)" ? "var(--primary)" : tone.ring }}
            />
          </motion.div>
        </div>

        {/* 区间标签 */}
        <div className="relative mt-5 h-10">
          {bands.map((r, i) => {
            const mid = (r.min + r.max) / 2;
            const leftPct = Math.min(100, Math.max(0, ((mid - min) / span) * 100));
            const color = rangeDashColor(r.level, i, bands.length);
            const key = `${r.min}-${r.max}`;
            const inRange = dim.score >= r.min && dim.score <= r.max;
            const reached = dim.score >= r.min;
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "absolute top-0 -translate-x-1/2 border-0 bg-transparent p-0 text-center transition-opacity",
                  inRange ? "opacity-100" : reached ? "opacity-60" : "opacity-35 hover:opacity-70"
                )}
                style={{ left: `${leftPct}%` }}
                onMouseEnter={() => setHoverKey(key)}
                onFocus={() => setHoverKey(key)}
              >
                <span
                  className="mb-1 mx-auto block h-3 w-px border-l border-dashed"
                  style={{ borderColor: color }}
                />
                <span className="block whitespace-nowrap text-[11px] font-medium" style={{ color }}>
                  {r.level}
                </span>
                <span className="block whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(r.min)}–{Math.round(r.max)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


interface DimensionRadarProps {
  dimensions: DimensionScoreItem[];
  getMax: (id: string) => number;
  getMin?: (id: string) => number;
  getRanges?: (id: string) => ScoreRange[] | undefined;
  onSelectDimension?: (id: string) => void;
}

/** 极简平面雷达：排除 total 维度；可点选旁显纵向位置 */
export function DimensionRadar({
  dimensions,
  getMax,
  getMin = () => 0,
  getRanges,
  onSelectDimension,
}: DimensionRadarProps) {
  // 远端逻辑：雷达优先使用非 total 子维度，避免总分轴挤占图面
  const primaryDimensions = dimensions.filter((dimension) => !dimension.id.endsWith("-total"));
  const radarDimensions = primaryDimensions.length >= 3 ? primaryDimensions : dimensions;

  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 162;
  const n = radarDimensions.length;

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => {
    return radarDimensions.map((d, i) => {
      const max = Math.max(1, getMax(d.id));
      const ratio = Math.min(1, Math.max(0, d.score / max));
      const tone = getLevelTone(d.level);
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
      const tip = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
      const value = {
        x: cx + Math.cos(angle) * radius * Math.max(0.04, ratio),
        y: cy + Math.sin(angle) * radius * Math.max(0.04, ratio),
      };
      const label = {
        x: cx + Math.cos(angle) * radius * 1.32,
        y: cy + Math.sin(angle) * radius * 1.32,
      };
      return { d, i, max, ratio, tone, tip, value, label };
    });
  }, [radarDimensions, getMax, n, cx, cy, radius]);

  if (n < 3) return null;

  const gridLevels = [0.33, 0.66, 1];
  const pointAt = (i: number, ratio: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };
  const ringPath = (lv: number) => {
    const pts = Array.from({ length: n }, (_, i) => pointAt(i, lv));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  };
  const valuePath =
    items.map((it, i) => `${i === 0 ? "M" : "L"} ${it.value.x} ${it.value.y}`).join(" ") + " Z";

  const focusId = selectedId ?? hoverId;
  const focused = items.find((it) => it.d.id === focusId) ?? null;
  const selected = items.find((it) => it.d.id === selectedId) ?? null;

  const selectDimension = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    onSelectDimension?.(id);
  };

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-6">
      <div className="mb-6">
        <h3 className="font-serif text-sm font-semibold tracking-wide">维度总览</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">点击维度查看所处位置</p>
      </div>

      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
        <div className="flex w-full max-w-[520px] justify-center lg:flex-1">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="mx-auto h-auto w-full max-w-[520px]"
            role="img"
            aria-label="维度雷达总览"
          >
            {gridLevels.map((lv) => (
              <path
                key={lv}
                d={ringPath(lv)}
                fill="none"
                stroke="currentColor"
                strokeWidth={lv === 1 ? 1 : 0.75}
                className="text-border"
              />
            ))}

            {items.map((it) => {
              const isFocus = focusId === it.d.id;
              return (
                <line
                  key={`axis-${it.d.id}`}
                  x1={cx}
                  y1={cy}
                  x2={it.tip.x}
                  y2={it.tip.y}
                  stroke="currentColor"
                  strokeWidth={isFocus ? 1.25 : 0.75}
                  className={isFocus ? "text-foreground/45" : "text-border"}
                />
              );
            })}

            <path
              d={valuePath}
              fill="color-mix(in oklab, var(--primary) 12%, transparent)"
              stroke="var(--primary)"
              strokeWidth={1.5}
            />

            {items.map((it) => {
              const isFocus = focusId === it.d.id;
              const [prefix, name] = it.d.title.includes("：")
                ? it.d.title.split(/：(.*)/)
                : ["", it.d.title];
              const displayName = name || it.d.title;
              const short =
                !prefix && displayName.length > 6
                  ? `${displayName.slice(0, 5)}…`
                  : displayName.length > 8
                    ? `${displayName.slice(0, 7)}…`
                    : displayName;
              const textAnchor =
                it.label.x < cx - 20 ? "start" : it.label.x > cx + 20 ? "end" : "middle";

              return (
                <g key={it.d.id}>
                  <circle
                    cx={it.value.x}
                    cy={it.value.y}
                    r={14}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverId(it.d.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => selectDimension(it.d.id)}
                  />
                  <circle
                    cx={it.value.x}
                    cy={it.value.y}
                    r={isFocus ? 3.25 : 2.5}
                    fill={isFocus ? "var(--foreground)" : "var(--primary)"}
                    className="pointer-events-none"
                  />
                  <text
                    x={it.label.x}
                    y={it.label.y}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fontSize={17}
                    className={cn(
                      "cursor-pointer select-none",
                      isFocus ? "fill-foreground font-medium" : "fill-muted-foreground"
                    )}
                    onMouseEnter={() => setHoverId(it.d.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => selectDimension(it.d.id)}
                  >
                    {prefix ? (
                      <>
                        <tspan x={it.label.x} dy="-0.65em">
                          {prefix}：
                        </tspan>
                        <tspan x={it.label.x} dy="1.4em">
                          {short}
                        </tspan>
                      </>
                    ) : (
                      short
                    )}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex w-full max-w-[160px] shrink-0 flex-col items-center justify-center border-t border-border/60 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <DimensionQuadrant
                  dim={selected.d}
                  max={selected.max}
                  min={getMin(selected.d.id)}
                  ranges={getRanges?.(selected.d.id)}
                  compact
                  hideRanges
                  hideLegend
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[140px] items-center justify-center"
              >
                <p className="text-center text-[12px] tracking-wide text-muted-foreground">
                  {focused ? focused.d.title : "选择维度"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
