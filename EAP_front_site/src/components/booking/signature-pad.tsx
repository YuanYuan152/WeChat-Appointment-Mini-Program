"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#F9FAFB";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#F9FAFB";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasStroke(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">请在下方区域内绘制您的签名</p>
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-xl border border-border bg-[#F9FAFB]"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={clear}>
          重写
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button type="button" className="flex-1" disabled={!hasStroke} onClick={confirm}>
          确认签名
        </Button>
      </div>
    </div>
  );
}
