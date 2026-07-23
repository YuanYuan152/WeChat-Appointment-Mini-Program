"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuizSession } from "@/lib/stores/quiz-session";
import type { Assessment } from "@/lib/api/types";

interface AssessmentShareButtonProps {
  assessment: Assessment;
  incomingShareCode?: string | null;
}

const POSTER_WIDTH = 900;
const POSTER_HEIGHT = 1200;

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("二维码图片生成失败"));
    image.src = source;
  });
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const characters = Array.from(text.trim());
  const lines: string[] = [];
  let line = "";
  for (const character of characters) {
    const candidate = `${line}${character}`;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => {
    const isTruncated = index === maxLines - 1 && lines.join("").length < characters.length;
    context.fillText(isTruncated ? `${item.replace(/.$/, "")}…` : item, x, startY + index * lineHeight);
  });
  return startY + lines.length * lineHeight;
}

async function createAssessmentPoster(
  assessment: Assessment,
  shareUrl: string
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成分享图片");

  const background = context.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  background.addColorStop(0, "#faf7f2");
  background.addColorStop(0.55, "#f3e7db");
  background.addColorStop(1, "#e3ece4");
  context.fillStyle = background;
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  context.fillStyle = "rgba(255,255,255,0.88)";
  drawRoundedRect(context, 60, 60, 780, 1080, 36);
  context.fill();

  context.textAlign = "center";
  context.fillStyle = "#c4795a";
  context.font = "600 30px system-ui, sans-serif";
  context.fillText("连心心理 · EAP 心理测评", 450, 130);

  context.fillStyle = "#2c2c2c";
  context.font = "700 54px system-ui, sans-serif";
  let nextY = drawWrappedText(context, assessment.title, 450, 225, 650, 70, 2);
  if (assessment.subtitle) {
    context.fillStyle = "#6b6560";
    context.font = "400 28px system-ui, sans-serif";
    nextY = drawWrappedText(context, assessment.subtitle, 450, nextY + 10, 650, 42, 2);
  }

  context.fillStyle = "#8b9a7b";
  context.font = "500 26px system-ui, sans-serif";
  context.fillText(
    `${assessment.questionCount} 题 · 约 ${assessment.duration} 分钟`,
    450,
    Math.max(nextY + 25, 385)
  );

  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 380,
    color: { dark: "#2c2c2c", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrDataUrl);
  context.fillStyle = "#ffffff";
  drawRoundedRect(context, 225, 455, 450, 450, 24);
  context.fill();
  context.drawImage(qrImage, 260, 490, 380, 380);

  context.fillStyle = "#2c2c2c";
  context.font = "600 32px system-ui, sans-serif";
  context.fillText("微信扫码开始测评", 450, 970);
  context.fillStyle = "#6b6560";
  context.font = "400 23px system-ui, sans-serif";
  context.fillText("分享的是量表入口，不包含个人作答与报告", 450, 1018);
  context.fillStyle = "#8a827b";
  context.font = "400 20px system-ui, sans-serif";
  context.fillText("测评结果仅供参考，不能替代专业诊断", 450, 1090);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("分享图片生成失败"))),
      "image/png",
      0.95
    );
  });
}

function safeFileName(title: string): string {
  const normalized = title.replace(/[\\/:*?"<>|]/g, "-").trim();
  return `${normalized || "心理测评"}-分享海报.png`;
}

export function AssessmentShareButton({
  assessment,
  incomingShareCode = null,
}: AssessmentShareButtonProps) {
  const setShareCode = useQuizSession((state) => state.setShareCode);
  const [open, setOpen] = useState(false);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const shareUrl = assessment.shareUrl ?? null;

  useEffect(() => {
    const verifiedIncomingCode =
      incomingShareCode && incomingShareCode === assessment.shareCode
        ? incomingShareCode
        : null;
    const syncAttribution = () => {
      setShareCode(assessment.id, verifiedIncomingCode);
    };
    if (useQuizSession.persist.hasHydrated()) {
      syncAttribution();
      return;
    }
    return useQuizSession.persist.onFinishHydration(syncAttribution);
  }, [assessment.id, assessment.shareCode, incomingShareCode, setShareCode]);

  useEffect(
    () => () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl);
    },
    [posterUrl]
  );

  const preparePoster = useCallback(async () => {
    if (!shareUrl || posterBlob || generating) return;
    setGenerating(true);
    setMessage(null);
    try {
      const blob = await createAssessmentPoster(assessment, shareUrl);
      const url = URL.createObjectURL(blob);
      setPosterBlob(blob);
      setPosterUrl(url);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "分享图片生成失败");
    } finally {
      setGenerating(false);
    }
  }, [assessment, generating, posterBlob, shareUrl]);

  const openDialog = () => {
    setOpen(true);
    void preparePoster();
  };

  const downloadPoster = () => {
    if (!posterBlob) return;
    const url = URL.createObjectURL(posterBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFileName(assessment.title);
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("分享图片已保存");
  };

  const sharePoster = async () => {
    if (!posterBlob || !shareUrl) return;
    const file = new File([posterBlob], safeFileName(assessment.title), {
      type: "image/png",
    });
    try {
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: assessment.title,
          text: `邀请你完成「${assessment.title}」心理测评`,
          url: shareUrl,
          files: [file],
        });
        setMessage("已打开系统分享面板");
        return;
      }
      downloadPoster();
      setMessage("当前浏览器不支持直接分享，已保存图片");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setMessage("分享未完成，可保存图片后从微信发送");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("量表链接已复制");
    } catch {
      setMessage("复制失败，请长按二维码保存图片");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDialog}
        disabled={!shareUrl}
        title={shareUrl ? "生成量表邀请海报" : "当前环境尚未配置量表分享"}
      >
        <Share2 className="mr-2 h-4 w-4" />
        分享量表
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto sm:max-w-lg"
          onClose={() => setOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>分享量表邀请</DialogTitle>
            <DialogDescription>
              海报只包含量表入口二维码，不包含你的答案或测评结果。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-muted/40">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={`${assessment.title}分享海报`}
                width={POSTER_WIDTH}
                height={POSTER_HEIGHT}
                unoptimized
                className="h-auto w-full"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-sm text-muted-foreground">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    正在生成分享图片…
                  </>
                ) : (
                  message ?? "分享图片尚未生成"
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            微信内可长按上方图片保存，再发送给好友或分享到朋友圈；支持系统分享的浏览器可直接点击“分享图片”。
          </p>
          {message && posterUrl ? (
            <p className="mt-2 text-sm text-primary">{message}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void sharePoster()} disabled={!posterBlob}>
              <Share2 className="mr-2 h-4 w-4" />
              分享图片
            </Button>
            <Button variant="outline" onClick={downloadPoster} disabled={!posterBlob}>
              <Download className="mr-2 h-4 w-4" />
              保存图片
            </Button>
            <Button variant="outline" onClick={() => void copyLink()}>
              <Copy className="mr-2 h-4 w-4" />
              复制链接
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
