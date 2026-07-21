"use client";

import type { Assessment, AssessmentScoreResult } from "@/lib/api/types";
import { getLevelTone, getRangeMax } from "@/components/assessment/report-score-visuals";

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
}

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function barColorOf(level: string) {
  const tone = getLevelTone(level);
  return tone.ring.startsWith("#") ? tone.ring : "#c4795a";
}

function hexAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = String(text).split(/\n/);
  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

type Cursor = { y: number };

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cursor: Cursor,
  maxWidth: number,
  opts: { size: number; color: string; weight?: string; lineHeight?: number; gapAfter?: number }
) {
  const { size, color, weight = "400", lineHeight = size * 1.55, gapAfter = 0 } = opts;
  ctx.font = `${weight} ${size}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const line of wrapText(ctx, text, maxWidth)) {
    ctx.fillText(line, x, cursor.y);
    cursor.y += lineHeight;
  }
  cursor.y += gapAfter;
}

function drawScoreBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  contentW: number,
  cursor: Cursor,
  label: string,
  score: number,
  max: number,
  level: string
) {
  const color = barColorOf(level);
  const badgePadX = 10;
  const badgePadY = 4;
  ctx.font = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  const badgeW = Math.ceil(ctx.measureText(level).width) + badgePadX * 2;
  const badgeH = 11 + badgePadY * 2;
  const rowTop = cursor.y;

  // label (left)
  ctx.font = `700 13px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#2c2c2c";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, rowTop);

  // badge (right, same baseline row)
  const badgeX = x + contentW - badgeW;
  drawRoundRect(ctx, badgeX, rowTop, badgeW, badgeH, 4, hexAlpha(color, 0.12));
  ctx.font = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level, badgeX + badgeW / 2, rowTop + badgeH / 2);

  cursor.y = rowTop + Math.max(20, badgeH + 4);

  // score meta
  ctx.font = `400 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#6b6560";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`得分 ${score} / 满分 ${max}`, x, cursor.y);
  cursor.y += 18;

  // progress track + fill (pixel-aligned)
  const barH = 8;
  const pct = max > 0 ? Math.min(1, Math.max(0, score / max)) : 0;
  const fillW = Math.max(pct > 0 ? 4 : 0, Math.round(contentW * pct));
  drawRoundRect(ctx, x, cursor.y, contentW, barH, 4, "#ece6dc");
  if (fillW > 0) {
    drawRoundRect(ctx, x, cursor.y, fillW, barH, 4, color);
  }
  cursor.y += barH + 12;
}

/** 在 PDF 中绘制维度总览雷达图，返回占用高度 */
function drawDimensionRadar(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  dimensions: { id: string; title: string; score: number }[],
  getMax: (id: string) => number
): number {
  if (dimensions.length < 3) return 0;

  const size = 200;
  const cx = centerX;
  const cy = topY + 28 + size / 2;
  const radius = 72;
  const n = dimensions.length;
  const primary = "#c4795a";
  const grid = "#e8e0d5";

  // title
  ctx.font = `700 13px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#2c2c2c";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("维度总览", cx, topY);

  const pointAt = (i: number, ratio: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };

  // grid rings
  for (const lv of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pointAt(i, lv);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // axes
  for (let i = 0; i < n; i++) {
    const tip = pointAt(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // value polygon
  const valuePts = dimensions.map((d, i) => {
    const max = Math.max(1, getMax(d.id));
    const ratio = Math.min(1, Math.max(0, d.score / max));
    return pointAt(i, ratio);
  });
  ctx.beginPath();
  valuePts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = hexAlpha(primary, 0.22);
  ctx.fill();
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  // dots
  for (const p of valuePts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  }

  // labels + score
  ctx.font = `600 10px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#6b6560";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  dimensions.forEach((d, i) => {
    const label = pointAt(i, 1.28);
    const name = d.title.length > 5 ? `${d.title.slice(0, 4)}…` : d.title;
    ctx.fillText(`${name} ${d.score}`, label.x, label.y);
  });

  return 28 + size + 28;
}

/**
 * Canvas 精确绘制报告 → 一页 A4 PDF（不使用 html2canvas，避免错位）
 */
export async function downloadAssessmentReportPdf(options: {
  assessment: Assessment;
  result: AssessmentScoreResult;
}): Promise<void> {
  const { assessment, result } = options;
  const filename = `${sanitizeFilename(assessment.title)}_测评报告.pdf`;

  // A4 逻辑尺寸 @96dpi，再按 SCALE 超采样绘制（约 288dpi）
  const SCALE = 3;
  const W = 794;
  const H = 1123;
  const margin = 42;
  const contentW = W - margin * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const cursor: Cursor = { y: margin };
  const x = margin;
  const footerReserve = 36;
  const contentBottom = H - margin - footerReserve;

  drawTextBlock(ctx, "连心心理 · 测评报告", x, cursor, contentW, {
    size: 13,
    color: "#c4795a",
    weight: "700",
    lineHeight: 18,
    gapAfter: 6,
  });
  drawTextBlock(ctx, assessment.title, x, cursor, contentW, {
    size: 20,
    color: "#2c2c2c",
    weight: "700",
    lineHeight: 28,
    gapAfter: 4,
  });
  if (assessment.subtitle) {
    drawTextBlock(ctx, assessment.subtitle, x, cursor, contentW, {
      size: 12,
      color: "#6b6560",
      lineHeight: 18,
      gapAfter: 2,
    });
  }
  drawTextBlock(ctx, `生成时间：${new Date().toLocaleString("zh-CN")}`, x, cursor, contentW, {
    size: 11,
    color: "#6b6560",
    lineHeight: 16,
    gapAfter: 14,
  });

  const intro = (assessment.reportIntro || assessment.features || "").trim();
  const dimCount = result.type === "dimension" ? result.dimensions.length : 0;
  const descLimit = dimCount >= 5 ? 140 : dimCount >= 3 ? 190 : 280;
  const suggestLimit = dimCount >= 5 ? 2 : 3;

  const ensureSpace = (need: number) => cursor.y + need < contentBottom;

  if (intro && ensureSpace(40)) {
    drawTextBlock(ctx, "测评说明", x, cursor, contentW, {
      size: 13,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 18,
      gapAfter: 4,
    });
    drawTextBlock(ctx, clip(intro, 240), x, cursor, contentW, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 10,
    });
    ctx.strokeStyle = "#e8e0d5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, cursor.y);
    ctx.lineTo(x + contentW, cursor.y);
    ctx.stroke();
    cursor.y += 12;
  }

  if (result.type === "sum") {
    drawScoreBlock(
      ctx,
      x,
      contentW,
      cursor,
      "测评得分",
      result.totalScore,
      getRangeMax(assessment.scoreRanges),
      result.level
    );
    if (assessment.scoreRanges?.length) {
      drawTextBlock(
        ctx,
        `得分区间：${assessment.scoreRanges.map((r) => `${r.level}（${r.min}–${r.max}）`).join("；")}`,
        x,
        cursor,
        contentW,
        { size: 11, color: "#6b6560", lineHeight: 16, gapAfter: 10 }
      );
    }
    drawTextBlock(ctx, "结果解读", x, cursor, contentW, {
      size: 13,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 18,
      gapAfter: 4,
    });
    drawTextBlock(ctx, clip(result.description, 320), x, cursor, contentW, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 10,
    });
    if (result.suggestions.length) {
      drawTextBlock(ctx, "建议", x, cursor, contentW, {
        size: 13,
        color: "#2c2c2c",
        weight: "700",
        lineHeight: 18,
        gapAfter: 4,
      });
      result.suggestions.slice(0, 5).forEach((s, i) => {
        if (!ensureSpace(20)) return;
        drawTextBlock(ctx, `${i + 1}. ${clip(s, 100)}`, x, cursor, contentW, {
          size: 11,
          color: "#6b6560",
          lineHeight: 17,
          gapAfter: 4,
        });
      });
    }
  } else if (result.type === "dimension") {
    if (result.summary) {
      drawTextBlock(ctx, clip(result.summary, 160), x, cursor, contentW, {
        size: 11,
        color: "#6b6560",
        lineHeight: 17,
        gapAfter: 10,
      });
    }

    // 维度总览雷达图
    if (result.dimensions.length >= 3 && ensureSpace(240)) {
      const radarH = drawDimensionRadar(
        ctx,
        x + contentW / 2,
        cursor.y,
        result.dimensions,
        (id) => getRangeMax(assessment.dimensions?.find((d) => d.id === id)?.scoreRanges)
      );
      cursor.y += radarH;
      ctx.strokeStyle = "#e8e0d5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, cursor.y);
      ctx.lineTo(x + contentW, cursor.y);
      ctx.stroke();
      cursor.y += 12;
    }

    result.dimensions.forEach((dim, idx) => {
      if (!ensureSpace(70)) return;
      const dimDef = assessment.dimensions?.find((d) => d.id === dim.id);
      const max = getRangeMax(dimDef?.scoreRanges);
      drawScoreBlock(ctx, x, contentW, cursor, dim.title, dim.score, max, dim.level);
      if (dimDef?.intro) {
        drawTextBlock(ctx, `维度说明：${clip(dimDef.intro, 120)}`, x, cursor, contentW, {
          size: 11,
          color: "#6b6560",
          lineHeight: 16,
          gapAfter: 3,
        });
      }
      drawTextBlock(ctx, `解读：${clip(dim.description, descLimit)}`, x, cursor, contentW, {
        size: 11,
        color: "#6b6560",
        lineHeight: 16,
        gapAfter: 3,
      });
      dim.suggestions.slice(0, suggestLimit).forEach((s) => {
        if (!ensureSpace(18)) return;
        drawTextBlock(ctx, `· ${clip(s, 85)}`, x + 10, cursor, contentW - 10, {
          size: 11,
          color: "#6b6560",
          lineHeight: 16,
          gapAfter: 2,
        });
      });
      if (idx < result.dimensions.length - 1 && ensureSpace(16)) {
        cursor.y += 6;
        ctx.strokeStyle = "#eee5d8";
        ctx.beginPath();
        ctx.moveTo(x, cursor.y);
        ctx.lineTo(x + contentW, cursor.y);
        ctx.stroke();
        cursor.y += 10;
      }
    });
  } else {
    drawTextBlock(ctx, `你的结果是：${result.title}`, x, cursor, contentW, {
      size: 14,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 20,
      gapAfter: 6,
    });
    drawTextBlock(ctx, clip(result.description, 360), x, cursor, contentW, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 8,
    });
    if (result.shareText) {
      drawTextBlock(ctx, `「${clip(result.shareText, 140)}」`, x, cursor, contentW, {
        size: 11,
        color: "#6b6560",
        lineHeight: 17,
        gapAfter: 4,
      });
    }
  }

  // footer fixed bottom center
  const footerLineY = H - margin - 22;
  ctx.strokeStyle = "#e8e0d5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, footerLineY);
  ctx.lineTo(x + contentW, footerLineY);
  ctx.stroke();
  ctx.font = `600 12px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#c4795a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("连心心理", W / 2, H - margin - 8);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // PNG 保文字边缘清晰；3x 超采样后再嵌入 A4
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "NONE");
  pdf.save(filename);
}
