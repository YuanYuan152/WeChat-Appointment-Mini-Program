"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, Download, Loader2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assessmentShareErrorMessage,
  assessmentPosterReducer,
  assessmentShareSourceKey,
  createAssessmentLinkSharePayload,
  createAssessmentPosterSharePayload,
  createAssessmentPosterState,
  isWechatUserAgent,
  safeAssessmentShareFileName,
} from "@/lib/assessment/assessment-share-state";
import type { Assessment } from "@/lib/api/types";

interface AssessmentShareButtonProps {
  assessment: Assessment;
  triggerLabel?: string;
  triggerSize?: "default" | "sm";
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

interface GeneratedAssessmentPoster {
  blob: Blob;
  previewDataUrl: string;
}

async function createAssessmentPoster(
  assessment: Assessment,
  shareUrl: string
): Promise<GeneratedAssessmentPoster> {
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

  const previewDataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("分享图片生成失败"))),
      "image/png",
      0.95
    );
  });
  return { blob, previewDataUrl };
}

export function AssessmentShareButton({
  assessment,
  triggerLabel = "分享量表",
  triggerSize = "sm",
}: AssessmentShareButtonProps) {
  const shareUrl = assessment.shareUrl?.trim() || null;
  const sourceKey = assessmentShareSourceKey(assessment.id, shareUrl);
  const contentKey = JSON.stringify([
    sourceKey,
    assessment.version ?? 0,
    assessment.title,
    assessment.subtitle ?? "",
    assessment.questionCount,
    assessment.duration,
  ]);

  return (
    <AssessmentShareButtonContent
      assessment={assessment}
      key={contentKey}
      shareUrl={shareUrl}
      sourceKey={contentKey}
      triggerLabel={triggerLabel}
      triggerSize={triggerSize}
    />
  );
}

function AssessmentShareButtonContent({
  assessment,
  shareUrl,
  sourceKey,
  triggerLabel,
  triggerSize,
}: {
  assessment: Assessment;
  shareUrl: string | null;
  sourceKey: string;
  triggerLabel: string;
  triggerSize: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const generationSequence = useRef(0);
  const allocatedObjectUrls = useRef(new Set<string>());
  const [posterState, dispatchPoster] = useReducer(
    assessmentPosterReducer<Blob>,
    createAssessmentPosterState<Blob>(sourceKey)
  );
  const poster = posterState.poster;
  const posterObjectUrl = poster?.objectUrl ?? null;
  const generating = posterState.status === "generating";

  useEffect(
    () => () => {
      if (posterObjectUrl) {
        URL.revokeObjectURL(posterObjectUrl);
        allocatedObjectUrls.current.delete(posterObjectUrl);
      }
    },
    [posterObjectUrl]
  );

  useEffect(
    () => () => {
      generationSequence.current += 1;
      allocatedObjectUrls.current.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
      allocatedObjectUrls.current.clear();
    },
    []
  );

  const preparePoster = useCallback(async () => {
    if (!shareUrl || posterState.status === "ready" || generating) return;
    const generation = ++generationSequence.current;
    dispatchPoster({
      type: "generation-started",
      sourceKey,
      generation,
    });
    setMessage(null);
    try {
      const generated = await createAssessmentPoster(assessment, shareUrl);
      if (generation !== generationSequence.current) return;
      const objectUrl = URL.createObjectURL(generated.blob);
      allocatedObjectUrls.current.add(objectUrl);
      if (generation !== generationSequence.current) {
        URL.revokeObjectURL(objectUrl);
        allocatedObjectUrls.current.delete(objectUrl);
        return;
      }
      dispatchPoster({
        type: "generation-succeeded",
        sourceKey,
        generation,
        poster: {
          ...generated,
          objectUrl,
        },
      });
    } catch (reason) {
      if (generation !== generationSequence.current) return;
      dispatchPoster({
        type: "generation-failed",
        sourceKey,
        generation,
        error: reason instanceof Error ? reason.message : "分享图片生成失败",
      });
    }
  }, [assessment, generating, posterState.status, shareUrl, sourceKey]);

  const openDialog = () => {
    setOpen(true);
    setMessage(null);
    void preparePoster();
  };

  const downloadPoster = () => {
    if (!poster) return;
    const anchor = document.createElement("a");
    anchor.href = poster.objectUrl;
    anchor.download = safeAssessmentShareFileName(assessment.title);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setMessage("已触发保存，请确认浏览器下载");
  };

  const copyShareUrl = async (): Promise<boolean> => {
    if (!shareUrl) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      }
    } catch {
      // Older WeChat WebViews can expose the Clipboard API but reject it.
      // Continue with the synchronous selection fallback while the click
      // still originates from the user's gesture.
    }

    const textarea = document.createElement("textarea");
    textarea.value = shareUrl;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  };

  const shareLink = async () => {
    if (!shareUrl) return;
    if (isWechatUserAgent(navigator.userAgent)) {
      const copied = await copyShareUrl();
      setMessage(
        copied
          ? "量表邀请链接已复制，请打开好友对话粘贴发送；分享到朋友圈请使用海报"
          : `请长按复制量表邀请链接后发送：${shareUrl}`
      );
      return;
    }

    if (typeof navigator.share !== "function") {
      setMessage("当前浏览器不支持系统分享，请复制链接后发送");
      return;
    }

    try {
      await navigator.share(createAssessmentLinkSharePayload(assessment.title, shareUrl));
      setMessage("已打开系统分享面板");
    } catch (reason) {
      setMessage(assessmentShareErrorMessage(reason, "link"));
    }
  };

  const sharePoster = async () => {
    if (!poster) return;
    if (isWechatUserAgent(navigator.userAgent)) {
      setMessage("请长按上方海报保存图片，再发送给微信好友或朋友圈");
      return;
    }

    const file = new File([poster.blob], safeAssessmentShareFileName(assessment.title), {
      type: "image/png",
    });
    const payload = createAssessmentPosterSharePayload(file);
    if (typeof navigator.share !== "function") {
      setMessage("当前浏览器不支持图片分享，请保存海报后发送");
      return;
    }

    if (typeof navigator.canShare === "function") {
      try {
        if (!navigator.canShare(payload)) {
          setMessage("当前浏览器不支持图片分享，请保存海报后发送");
          return;
        }
      } catch {
        setMessage("当前浏览器无法确认图片分享能力，请保存海报后发送");
        return;
      }
    }

    try {
      await navigator.share(payload);
      setMessage("已打开系统分享面板");
    } catch (reason) {
      setMessage(assessmentShareErrorMessage(reason, "poster"));
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    const copied = await copyShareUrl();
    setMessage(
      copied
        ? "量表邀请链接已复制"
        : `复制失败，请长按复制此链接：${shareUrl}`
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={triggerSize}
        onClick={openDialog}
        disabled={!shareUrl}
        title={shareUrl ? "生成量表邀请海报" : "当前环境尚未配置量表分享"}
      >
        <Share2 className="mr-2 h-4 w-4" />
        {triggerLabel}
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
            {poster ? (
              <Image
                src={poster.previewDataUrl}
                alt={`${assessment.title}分享海报`}
                width={POSTER_WIDTH}
                height={POSTER_HEIGHT}
                unoptimized
                draggable={false}
                className="h-auto w-full"
                style={{ WebkitTouchCallout: "default" }}
              />
            ) : (
              <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 px-6 text-center text-sm text-muted-foreground">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    正在生成分享图片…
                  </>
                ) : (
                  <>
                    <span>{posterState.error ?? "分享图片尚未生成"}</span>
                    {posterState.status === "error" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void preparePoster()}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新生成
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            微信内可复制链接发送给好友，或长按保存海报后发送给好友、发布朋友圈；其他浏览器可分别调用系统分享。
          </p>
          {message ? (
            <p className="mt-2 select-text break-all text-sm text-primary">{message}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void shareLink()}>
              <Share2 className="mr-2 h-4 w-4" />
              分享链接
            </Button>
            <Button variant="outline" onClick={() => void sharePoster()} disabled={!poster}>
              <Share2 className="mr-2 h-4 w-4" />
              分享海报
            </Button>
            <Button variant="outline" onClick={downloadPoster} disabled={!poster}>
              <Download className="mr-2 h-4 w-4" />
              保存海报
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
