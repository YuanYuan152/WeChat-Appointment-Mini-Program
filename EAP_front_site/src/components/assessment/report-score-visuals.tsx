"use client";

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

/** 维度横向进度条 + 区间刻度 */
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
        {/* 分数指针 */}
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

interface DimensionRadarProps {
  dimensions: DimensionScoreItem[];
  getMax: (id: string) => number;
}

/** 多维度雷达示意（简化多边形） */
export function DimensionRadar({ dimensions, getMax }: DimensionRadarProps) {
  const primaryDimensions = dimensions.filter((dimension) => !dimension.id.endsWith("-total"));
  const radarDimensions = primaryDimensions.length >= 3 ? primaryDimensions : dimensions;
  if (radarDimensions.length < 3) return null;

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 105;
  const n = radarDimensions.length;

  const pointAt = (i: number, ratio: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const valuePoints = radarDimensions.map((d, i) => {
    const max = Math.max(1, getMax(d.id));
    const ratio = Math.min(1, Math.max(0, d.score / max));
    return pointAt(i, ratio);
  });
  const valuePath = valuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="flex flex-col items-center rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-2 font-serif text-sm font-semibold">维度总览</h3>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        {gridLevels.map((lv) => {
          const pts = Array.from({ length: n }, (_, i) => pointAt(i, lv));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path
              key={lv}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
          );
        })}
        {radarDimensions.map((_, i) => {
          const tip = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
          );
        })}
        <path d={valuePath} fill="color-mix(in oklab, var(--primary) 25%, transparent)" stroke="var(--primary)" strokeWidth={2} />
        {valuePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--primary)" />
        ))}
        {radarDimensions.map((d, i) => {
          const label = pointAt(i, 1.38);
          const [prefix, name] = d.title.includes("：")
            ? d.title.split(/：(.*)/)
            : ["", d.title];
          const textAnchor =
            label.x < cx - 20 ? "start" : label.x > cx + 20 ? "end" : "middle";
          return (
            <text
              key={d.id}
              x={label.x}
              y={label.y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {prefix ? (
                <>
                  <tspan x={label.x} dy="-0.6em">
                    {prefix}：
                  </tspan>
                  <tspan x={label.x} dy="1.35em">
                    {name}
                  </tspan>
                </>
              ) : (
                d.title
              )}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
