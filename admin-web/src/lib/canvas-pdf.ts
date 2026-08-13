export interface CanvasPdfTextBlock {
  type: "text";
  text: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  gapBefore?: number;
  gapAfter?: number;
}

export interface CanvasPdfImageBlock {
  type: "image";
  image: CanvasImageSource;
  width: number;
  height: number;
  caption?: string;
  gapBefore?: number;
}

export type CanvasPdfBlock = CanvasPdfTextBlock | CanvasPdfImageBlock;

export interface CanvasPdfOptions {
  filename: string;
  blocks: CanvasPdfBlock[];
  pageTitle?: string;
}

interface TextLine {
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  gapBefore: number;
  gapAfter: number;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 96;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FOOTER_HEIGHT = 54;

export function sanitizePdfFilename(value: string): string {
  const name = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return `${name || "下载文件"}.pdf`;
}

export function splitCanvasText(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      result.push("");
      continue;
    }
    let line = "";
    for (const character of Array.from(paragraph)) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        result.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    result.push(line);
  }
  return result;
}

export async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveCanvasPdf({ filename, blocks, pageTitle }: CanvasPdfOptions): Promise<void> {
  const pages = renderCanvasPages(blocks, pageTitle);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pages.forEach((canvas, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  });
  pdf.save(sanitizePdfFilename(filename.replace(/\.pdf$/i, "")));
}

function renderCanvasPages(blocks: CanvasPdfBlock[], pageTitle?: string): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = [];
  let canvas = createPageCanvas();
  let context = requiredContext(canvas);
  let y = PAGE_MARGIN;

  const newPage = () => {
    pages.push(canvas);
    canvas = createPageCanvas();
    context = requiredContext(canvas);
    y = PAGE_MARGIN;
    if (pageTitle) {
      y = drawTextLines(context, toLines(context, {
        type: "text",
        text: pageTitle,
        fontSize: 24,
        bold: true,
        color: "#6b6258",
        gapAfter: 18,
      }), y);
    }
  };

  for (const block of blocks) {
    if (block.type === "image") {
      const captionReserve = block.caption ? 70 : 0;
      const maxImageHeight =
        PAGE_HEIGHT - PAGE_MARGIN * 2 - FOOTER_HEIGHT - captionReserve;
      const scale = Math.min(1, CONTENT_WIDTH / block.width, maxImageHeight / block.height);
      const drawWidth = Math.max(1, block.width * scale);
      const drawHeight = Math.max(1, block.height * scale);
      if (
        y + (block.gapBefore ?? 18) + drawHeight + captionReserve >
        PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT
      ) {
        newPage();
      }
      y += block.gapBefore ?? 18;
      context.drawImage(block.image, PAGE_MARGIN, y, drawWidth, drawHeight);
      y += drawHeight;
      if (block.caption) {
        y = drawTextLines(context, toLines(context, {
          type: "text",
          text: block.caption,
          fontSize: 22,
          color: "#756d64",
          gapBefore: 10,
          gapAfter: 12,
        }), y);
      }
      continue;
    }

    const lines = toLines(context, block);
    for (const line of lines) {
      const lineHeight = Math.ceil(line.fontSize * 1.65);
      const requiredHeight = line.gapBefore + lineHeight + line.gapAfter;
      if (y + requiredHeight > PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT) newPage();
      y = drawTextLines(context, [line], y);
    }
  }
  pages.push(canvas);

  pages.forEach((page, index) => {
    const pageContext = requiredContext(page);
    pageContext.font = '22px "Microsoft YaHei", "PingFang SC", sans-serif';
    pageContext.fillStyle = "#8b8379";
    pageContext.textAlign = "center";
    pageContext.fillText(`${index + 1} / ${pages.length}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 44);
    pageContext.textAlign = "left";
  });
  return pages;
}

function toLines(context: CanvasRenderingContext2D, block: CanvasPdfTextBlock): TextLine[] {
  const fontSize = block.fontSize ?? 30;
  const bold = block.bold ?? false;
  context.font = `${bold ? 600 : 400} ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  return splitCanvasText(context, block.text, CONTENT_WIDTH).map((text, index, values) => ({
    text,
    fontSize,
    bold,
    color: block.color ?? "#28231f",
    gapBefore: index === 0 ? block.gapBefore ?? 0 : 0,
    gapAfter: index === values.length - 1 ? block.gapAfter ?? 0 : 0,
  }));
}

function drawTextLines(context: CanvasRenderingContext2D, lines: TextLine[], startY: number): number {
  let y = startY;
  for (const line of lines) {
    y += line.gapBefore;
    context.font = `${line.bold ? 600 : 400} ${line.fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    context.fillStyle = line.color;
    context.fillText(line.text || " ", PAGE_MARGIN, y + line.fontSize);
    y += Math.ceil(line.fontSize * 1.65) + line.gapAfter;
  }
  return y;
}

function createPageCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = requiredContext(canvas);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.textBaseline = "alphabetic";
  return canvas;
}

function requiredContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法创建 PDF 画布");
  return context;
}
