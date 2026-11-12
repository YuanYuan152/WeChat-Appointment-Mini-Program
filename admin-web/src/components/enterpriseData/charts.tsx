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

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 150,
  thickness = 20,
  center,
  sub,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center: string;
  sub: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="#EFECE6" strokeWidth={thickness} />
        {total > 0 &&
          segments
            .filter((item) => item.value > 0)
            .map((item) => {
              const length = (item.value / total) * circumference;
              const element = (
                <circle
                  key={item.key}
                  cx={size / 2}
                  cy={size / 2}
                  fill="none"
                  r={radius}
                  stroke={item.color}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeWidth={thickness}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += length;
              return element;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold text-[var(--lxxl-text)]">{center}</div>
        <div className="mt-1 text-[11px] text-[var(--lxxl-muted)]">{sub}</div>
      </div>
    </div>
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
