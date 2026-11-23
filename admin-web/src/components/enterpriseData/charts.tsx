"use client";

import type { TrendPoint } from "@/lib/enterpriseData";

const GREEN = "#3D5A4E";
const RISK = "#B86A1E";

/** 柱：每月答卷数；折线：中高风险检出率。 */
export function TrendChart({ points, height = 220 }: { points: TrendPoint[]; height?: number }) {
  const width = 560;
  const padLeft = 36;
  const padRight = 40;
  const padTop = 18;
  const padBottom = 28;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const maxCount = Math.max(4, ...points.map((point) => point.reports));
  const niceMax = Math.ceil(maxCount / 4) * 4;
  const band = innerWidth / Math.max(points.length, 1);
  const yCount = (value: number) => padTop + innerHeight - (value / niceMax) * innerHeight;
  const yRate = (value: number) => padTop + innerHeight - value * innerHeight;
  const ratePoints = points
    .map((point, index) => (point.riskRate === null ? null : { x: padLeft + band * index + band / 2, y: yRate(point.riskRate), rate: point.riskRate }))
    .filter((item): item is { x: number; y: number; rate: number } => item !== null);

  return (
    <svg aria-label="月度答卷数与风险检出率" className="block w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = padTop + innerHeight - step * innerHeight;
        return (
          <g key={step}>
            <line stroke="#EFECE6" x1={padLeft} x2={width - padRight} y1={y} y2={y} />
            <text fill="#8A8A8A" fontSize="10" textAnchor="end" x={padLeft - 8} y={y + 3}>
              {Math.round(niceMax * step)}
            </text>
            <text fill={RISK} fontSize="10" x={width - padRight + 8} y={y + 3}>
              {Math.round(step * 100)}%
            </text>
          </g>
        );
      })}
      {points.map((point, index) => {
        const x = padLeft + band * index;
        const barWidth = Math.min(36, band * 0.46);
        const y = yCount(point.reports);
        return (
          <g key={point.key}>
            <rect
              fill={index === points.length - 1 ? GREEN : `${GREEN}66`}
              height={Math.max(0, padTop + innerHeight - y)}
              rx="3"
              width={barWidth}
              x={x + (band - barWidth) / 2}
              y={y}
            >
              <title>{`${point.label}：答卷 ${point.reports} 份，新增 ${point.newRespondents} 人`}</title>
            </rect>
            {point.reports > 0 && (
              <text fill="#2C2C2C" fontSize="10" textAnchor="middle" x={x + band / 2} y={y - 5}>
                {point.reports}
              </text>
            )}
            <text fill="#6B6B6B" fontSize="11" textAnchor="middle" x={x + band / 2} y={height - 8}>
              {point.label}
            </text>
          </g>
        );
      })}
      {ratePoints.length > 1 && (
        <polyline
          fill="none"
          points={ratePoints.map((item) => `${item.x},${item.y}`).join(" ")}
          stroke={RISK}
          strokeWidth="2"
        />
      )}
      {ratePoints.map((item) => (
        <circle key={`${item.x}`} cx={item.x} cy={item.y} fill="#fff" r="3.5" stroke={RISK} strokeWidth="2">
          <title>{`风险检出率 ${Math.round(item.rate * 1000) / 10}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function Pie({ segments }: { segments: Array<{ value: number; color: string }> }) {
  const visible = segments.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  if (!total) return null;
  let cumulative = 0;
  const sectors = visible.map((item) => {
    const from = (cumulative / total) * 360;
    cumulative += item.value;
    return `${item.color} ${from}deg ${(cumulative / total) * 360}deg`;
  });

  return (
    <div
      aria-hidden="true"
      className="size-[150px] shrink-0 rounded-full"
      style={{ background: visible.length === 1 ? visible[0].color : `conic-gradient(${sectors.join(", ")})` }}
    />
  );
}

/** 热力色：比例越高越红。 */
export function heatColor(rate: number | null): { bg: string; fg: string } {
  if (rate === null) {
    return { bg: "#F4F1EB", fg: "#8A8A8A" };
  }
  if (rate >= 0.5) return { bg: "#F6D3CF", fg: "#8E1F18" };
  if (rate >= 0.3) return { bg: "#FBE3DF", fg: "#B3261E" };
  if (rate >= 0.15) return { bg: "#FCEFE0", fg: "#9A5612" };
  if (rate > 0) return { bg: "#FBF6E6", fg: "#7A5A1A" };
  return { bg: "#EAF2ED", fg: "#2F6B4E" };
}
