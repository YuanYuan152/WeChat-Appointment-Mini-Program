"use client";

import type { Assessment, AssessmentScoreResult } from "@/lib/api/types";
import { EAP_TONES } from "@/components/assessment/report-visual-blocks";
import {
  buildReportVisualModel,
  formatVisualScore,
  type VisualScore,
} from "@/lib/assessment/report-visual-model";
import { ASSISTANT_CONTACT } from "@/lib/booking/contact-info";

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
}

function barColorOf(item: VisualScore) {
  return EAP_TONES[item.tone].color;
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

type PageCtx = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cursor: Cursor;
};

const SCALE = 3;
const PAGE_W = 794;
const PAGE_H = 1123;
const MARGIN = 42;
/** 为页脚 + 右下角二维码预留空间 */
const FOOTER_RESERVE = 96;
const ASSISTANT_QR_CAPTION = "如需获取完整详细报告和专业指导请扫码联系助理";

function createPage(): PageCtx {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W * SCALE);
  canvas.height = Math.round(PAGE_H * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx, cursor: { y: MARGIN } };
}

function drawPageFooter(ctx: CanvasRenderingContext2D, pageNo: number, pageTotal: number) {
  const x = MARGIN;
  const contentW = PAGE_W - MARGIN * 2;
  const footerLineY = PAGE_H - MARGIN - 22;
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
  ctx.fillText("连心心理", PAGE_W / 2, PAGE_H - MARGIN - 8);
  ctx.font = `400 10px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(`${pageNo} / ${pageTotal}`, PAGE_W - MARGIN - 20, PAGE_H - MARGIN - 8);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法加载助理二维码"));
    image.src = src;
  });
}

/** 报告右下角：二维码 + 浅色说明（画在页脚线上方） */
function drawAssistantQrCorner(
  ctx: CanvasRenderingContext2D,
  assistantQr: HTMLImageElement
) {
  const blockRight = PAGE_W - MARGIN;
  const blockW = 100;
  const footerLineY = PAGE_H - MARGIN - 22;
  const captionLineH = 11;
  const captionLines = 2;
  const gap = 4;
  const qrSize = 52;
  const blockH = qrSize + gap + captionLineH * captionLines;
  const qrLeft = blockRight - qrSize;
  const blockTop = footerLineY - 8 - blockH;

  const sourceWidth = assistantQr.naturalWidth;
  const sourceHeight = assistantQr.naturalHeight;
  ctx.drawImage(
    assistantQr,
    sourceWidth * 0.1,
    sourceHeight * 0.33,
    sourceWidth * 0.8,
    sourceHeight * 0.5,
    qrLeft,
    blockTop,
    qrSize,
    qrSize
  );

  ctx.font = `400 8px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "rgba(107,101,96,0.72)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const captionY = blockTop + qrSize + gap;
  const wrapped = wrapText(ctx, ASSISTANT_QR_CAPTION, blockW);
  wrapped.slice(0, captionLines).forEach((line, i) => {
    ctx.fillText(line, blockRight, captionY + i * captionLineH);
  });
}

function drawContinuationHeader(
  ctx: CanvasRenderingContext2D,
  cursor: Cursor,
  title: string
) {
  const x = MARGIN;
  const contentW = PAGE_W - MARGIN * 2;
  ctx.font = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#c4795a";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`连心心理 · ${title}（续）`, x, cursor.y);
  cursor.y += 18;
  ctx.strokeStyle = "#e8e0d5";
  ctx.beginPath();
  ctx.moveTo(x, cursor.y);
  ctx.lineTo(x + contentW, cursor.y);
  ctx.stroke();
  cursor.y += 12;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cursor: Cursor,
  maxWidth: number,
  opts: {
    size: number;
    color: string;
    weight?: string;
    lineHeight?: number;
    gapAfter?: number;
    /** 每写一行前检查空间；不够则换页并返回新 ctx/cursor */
    ensureLine?: (lineHeight: number) => { ctx: CanvasRenderingContext2D; cursor: Cursor };
  }
) {
  const { size, color, weight = "400", lineHeight = size * 1.55, gapAfter = 0, ensureLine } = opts;
  let activeCtx = ctx;
  let activeCursor = cursor;
  activeCtx.font = `${weight} ${size}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
  activeCtx.fillStyle = color;
  activeCtx.textAlign = "left";
  activeCtx.textBaseline = "top";
  for (const line of wrapText(activeCtx, text, maxWidth)) {
    if (ensureLine) {
      const next = ensureLine(lineHeight);
      activeCtx = next.ctx;
      activeCursor = next.cursor;
      activeCtx.font = `${weight} ${size}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
      activeCtx.fillStyle = color;
      activeCtx.textAlign = "left";
      activeCtx.textBaseline = "top";
    }
    activeCtx.fillText(line, x, activeCursor.y);
    activeCursor.y += lineHeight;
  }
  activeCursor.y += gapAfter;
}

function drawScoreBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  contentW: number,
  cursor: Cursor,
  label: string,
  item: VisualScore
) {
  const color = barColorOf(item);
  const level = item.level || "—";
  const badgePadX = 10;
  const badgePadY = 4;
  ctx.font = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  const badgeW = Math.ceil(ctx.measureText(level).width) + badgePadX * 2;
  const badgeH = 11 + badgePadY * 2;
  const rowTop = cursor.y;

  ctx.font = `700 13px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#2c2c2c";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, rowTop);

  const badgeX = x + contentW - badgeW;
  drawRoundRect(ctx, badgeX, rowTop, badgeW, badgeH, 4, hexAlpha(color, 0.12));
  ctx.font = `600 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(level, badgeX + badgeW / 2, rowTop + badgeH / 2);

  cursor.y = rowTop + Math.max(20, badgeH + 4);

  ctx.font = `400 11px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#6b6560";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    `得分 ${formatVisualScore(item.score)} / 满分 ${formatVisualScore(item.max)}`,
    x,
    cursor.y
  );
  cursor.y += 18;

  const barH = 8;
  const pct = item.ratio;
  const fillW = Math.max(pct > 0 ? 4 : 0, Math.round(contentW * pct));
  drawRoundRect(ctx, x, cursor.y, contentW, barH, 4, "#ece6dc");
  if (fillW > 0) {
    drawRoundRect(ctx, x, cursor.y, fillW, barH, 4, color);
  }
  const span = item.max - item.min || 1;
  for (const marker of item.markers) {
    const markerX = x + Math.round(contentW * Math.min(1, Math.max(0, (marker.value - item.min) / span)));
    ctx.fillStyle = "rgba(44,44,44,0.55)";
    ctx.fillRect(markerX - 1, cursor.y - 2, 2, barH + 4);
  }
  cursor.y += barH + 12;
}

function drawDimensionRadar(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  dimensions: VisualScore[]
): number {
  if (dimensions.length < 3) return 0;

  const size = 200;
  const cx = centerX;
  const cy = topY + 28 + size / 2;
  const radius = 72;
  const n = dimensions.length;
  const primary = "#c4795a";
  const grid = "#e8e0d5";

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

  for (let i = 0; i < n; i++) {
    const tip = pointAt(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const valuePts = dimensions.map((d, i) => pointAt(i, Math.max(0.04, d.ratio)));
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

  for (const p of valuePts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  }

  ctx.font = `600 10px "Microsoft YaHei","PingFang SC",sans-serif`;
  ctx.fillStyle = "#6b6560";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  dimensions.forEach((d, i) => {
    const label = pointAt(i, 1.38);
    const name =
      d.label.replace(/^维度[一二三四五六七八九十\d]+[：:]\s*/, "").trim() || d.label;
    const maxChars = 6;
    const lines: string[] = [];
    for (let j = 0; j < name.length; j += maxChars) {
      lines.push(name.slice(j, j + maxChars));
    }
    if (lines.length === 0) lines.push(name);
    const lineH = 12;
    const startY = label.y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, li) => {
      ctx.fillText(line, label.x, startY + li * lineH);
    });
  });

  return 28 + size + 28;
}

/**
 * Canvas 绘制报告，内容超出时自动分页
 */
export async function downloadAssessmentReportPdf(options: {
  assessment: Assessment;
  result: AssessmentScoreResult;
}): Promise<void> {
  const { assessment, result } = options;
  const filename = `${sanitizeFilename(assessment.title)}_测评报告.pdf`;
  const assistantQr = await loadImage(ASSISTANT_CONTACT.qrcodeSrc);

  const pages: PageCtx[] = [createPage()];
  let page = pages[0];
  const x = MARGIN;
  const contentW = PAGE_W - MARGIN * 2;
  const contentBottom = PAGE_H - MARGIN - FOOTER_RESERVE;

  const ensureSpace = (need: number) => {
    if (page.cursor.y + need <= contentBottom) return;
    const next = createPage();
    pages.push(next);
    page = next;
    drawContinuationHeader(page.ctx, page.cursor, assessment.title);
  };

  const lineGuard = (lineHeight: number) => {
    ensureSpace(lineHeight + 2);
    return { ctx: page.ctx, cursor: page.cursor };
  };

  // —— 首页抬头 ——
  drawTextBlock(page.ctx, "连心心理 · 测评报告", x, page.cursor, contentW, {
    size: 13,
    color: "#c4795a",
    weight: "700",
    lineHeight: 18,
    gapAfter: 6,
  });
  drawTextBlock(page.ctx, assessment.title, x, page.cursor, contentW, {
    size: 20,
    color: "#2c2c2c",
    weight: "700",
    lineHeight: 28,
    gapAfter: 4,
    ensureLine: lineGuard,
  });
  if (assessment.subtitle) {
    drawTextBlock(page.ctx, assessment.subtitle, x, page.cursor, contentW, {
      size: 12,
      color: "#6b6560",
      lineHeight: 18,
      gapAfter: 2,
      ensureLine: lineGuard,
    });
  }
  drawTextBlock(
    page.ctx,
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    x,
    page.cursor,
    contentW,
    { size: 11, color: "#6b6560", lineHeight: 16, gapAfter: 14 }
  );

  const intro = (assessment.reportIntro || assessment.features || "").trim();

  if (intro) {
    ensureSpace(40);
    drawTextBlock(page.ctx, "测评说明", x, page.cursor, contentW, {
      size: 13,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 18,
      gapAfter: 4,
    });
    drawTextBlock(page.ctx, intro, x, page.cursor, contentW, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 10,
      ensureLine: lineGuard,
    });
    page.ctx.strokeStyle = "#e8e0d5";
    page.ctx.lineWidth = 1;
    page.ctx.beginPath();
    page.ctx.moveTo(x, page.cursor.y);
    page.ctx.lineTo(x + contentW, page.cursor.y);
    page.ctx.stroke();
    page.cursor.y += 12;
  }

  const model = buildReportVisualModel(assessment, result);
  const sectionTitle = (text: string) => {
    ensureSpace(40);
    drawTextBlock(page.ctx, text, x, page.cursor, contentW, {
      size: 13,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 18,
      gapAfter: 4,
    });
  };
  const paragraph = (text: string, indent = 0) => {
    ensureSpace(24);
    drawTextBlock(page.ctx, text, x + indent, page.cursor, contentW - indent, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 6,
      ensureLine: lineGuard,
    });
  };
  const divider = () => {
    ensureSpace(16);
    page.cursor.y += 6;
    page.ctx.strokeStyle = "#eee5d8";
    page.ctx.lineWidth = 1;
    page.ctx.beginPath();
    page.ctx.moveTo(x, page.cursor.y);
    page.ctx.lineTo(x + contentW, page.cursor.y);
    page.ctx.stroke();
    page.cursor.y += 10;
  };
  const drawScoreSection = (item: VisualScore, label: string, depth = 0) => {
    ensureSpace(90);
    drawScoreBlock(page.ctx, x + depth * 12, contentW - depth * 12, page.cursor, label, item);
    if (item.bands.length > 1 && depth === 0) {
      paragraph(
        `得分区间：${item.bands
          .map((band) => `${band.level}（${formatVisualScore(band.min)}–${formatVisualScore(band.max)}）`)
          .join("；")}`
      );
    }
    if (item.markers.length) {
      paragraph(item.markers.map((marker) => marker.label).join("；"), depth * 12);
    }
    if (item.intro) {
      paragraph(`说明：${item.intro}`, depth * 12);
    }
    if (item.description) {
      paragraph(`解读：${item.description}`, depth * 12);
    }
    item.suggestions.forEach((suggestion, index) => {
      paragraph(`${index + 1}. ${suggestion}`, depth * 12 + 10);
    });
    item.children.forEach((child) => drawScoreSection(child, `子维度 · ${child.title}`, depth + 1));
  };

  if (model.kind === "score" && model.hero) {
    drawScoreSection(model.hero, "测评得分");
  } else if (model.kind === "profile") {
    if (model.hero) {
      drawScoreSection(model.hero, model.hero.title || "总分");
      divider();
    }
    if (model.summary) {
      paragraph(model.summary);
    }
    model.quadrants.forEach((quadrant) => {
      paragraph(
        `${quadrant.title}：${quadrant.result}（${quadrant.x.label} ${formatVisualScore(quadrant.x.score)}，${quadrant.y.label} ${formatVisualScore(quadrant.y.score)}）`
      );
    });

    if (model.radar.length >= 3) {
      ensureSpace(260);
      const radarH = drawDimensionRadar(page.ctx, x + contentW / 2, page.cursor.y, model.radar);
      page.cursor.y += radarH;
      divider();
    }

    model.groups.forEach((group, groupIndex) => {
      if (group.title) {
        sectionTitle(group.title);
      }
      group.items.forEach((item, index) => {
        drawScoreSection(item, item.title);
        const last = groupIndex === model.groups.length - 1 && index === group.items.length - 1;
        if (!last) {
          divider();
        }
      });
    });
  } else if (result.type === "match") {
    ensureSpace(40);
    drawTextBlock(page.ctx, `你的结果是：${result.title}`, x, page.cursor, contentW, {
      size: 14,
      color: "#2c2c2c",
      weight: "700",
      lineHeight: 20,
      gapAfter: 6,
    });
    drawTextBlock(page.ctx, result.description, x, page.cursor, contentW, {
      size: 11,
      color: "#6b6560",
      lineHeight: 17,
      gapAfter: 8,
      ensureLine: lineGuard,
    });
    const matchSuggestions = model.match?.suggestions ?? [];
    if (matchSuggestions.length) {
      sectionTitle("建议");
      matchSuggestions.forEach((suggestion, index) => paragraph(`${index + 1}. ${suggestion}`));
    }
    if (result.shareText) {
      ensureSpace(30);
      drawTextBlock(page.ctx, `「${result.shareText}」`, x, page.cursor, contentW, {
        size: 11,
        color: "#6b6560",
        lineHeight: 17,
        gapAfter: 4,
        ensureLine: lineGuard,
      });
    }
  }

  // 页脚 + 末页右下角二维码 + 导出
  const total = pages.length;
  pages.forEach((p, i) => {
    drawPageFooter(p.ctx, i + 1, total);
    if (i === total - 1) {
      drawAssistantQrCorner(p.ctx, assistantQr);
    }
  });

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(p.canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "NONE");
  });
  pdf.save(filename);
}
