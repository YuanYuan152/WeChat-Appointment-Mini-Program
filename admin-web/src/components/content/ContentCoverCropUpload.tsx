"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import {
  computeCropFromTransform,
  cropToTransform,
  defaultCropForImage,
  HERO_COVER_ASPECT,
  normalizeCoverCrop,
  type CoverCrop,
} from "@/lib/coverCrop";
import { uploadImage } from "@/services/uploads";

const VIEWPORT_WIDTH = 360;

export function ContentCoverCropUpload({
  imageUrl,
  crop,
  onChange,
}: {
  imageUrl: string;
  crop: CoverCrop;
  onChange: (next: { imageUrl: string; crop: CoverCrop }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const viewportHeight = VIEWPORT_WIDTH / HERO_COVER_ASPECT;
  const previewUrl = resolveImageUrl(imageUrl);

  const syncCrop = useCallback(
    (nextZoom: number, nextOffset: { x: number; y: number }, size = naturalSize) => {
      if (!imageUrl || size.width <= 0 || size.height <= 0) {
        return;
      }
      const nextCrop = computeCropFromTransform(
        size.width,
        size.height,
        VIEWPORT_WIDTH,
        viewportHeight,
        nextZoom,
        nextOffset.x,
        nextOffset.y,
      );
      onChange({ imageUrl, crop: nextCrop });
    },
    [imageUrl, naturalSize, onChange, viewportHeight],
  );

  useEffect(() => {
    if (!previewUrl) {
      setNaturalSize({ width: 0, height: 0 });
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setNaturalSize(size);
      const initialCrop = normalizeCoverCrop(crop);
      const transform = cropToTransform(initialCrop, size.width, size.height, VIEWPORT_WIDTH, viewportHeight);
      setZoom(transform.zoom);
      setOffset({ x: transform.offsetX, y: transform.offsetY });
    };
    img.src = previewUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, imageUrl, crop.x, crop.y, crop.width, crop.height]);

  async function handleFile(file: File | undefined) {
    if (!file || uploading) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片大小不能超过 10MB");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const result = await uploadImage(file);
      if (!result.url?.trim()) {
        throw new Error("上传接口未返回图片地址");
      }
      const url = result.url.trim();
      const img = await loadImage(resolveImageUrl(url));
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      const nextCrop = defaultCropForImage(size.width, size.height);
      const transform = cropToTransform(nextCrop, size.width, size.height, VIEWPORT_WIDTH, viewportHeight);
      setNaturalSize(size);
      setZoom(transform.zoom);
      setOffset({ x: transform.offsetX, y: transform.offsetY });
      onChange({ imageUrl: url, crop: nextCrop });
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  function handlePointerDown(clientX: number, clientY: number) {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function handlePointerMove(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const nextOffset = {
      x: drag.originX + (clientX - drag.startX),
      y: drag.originY + (clientY - drag.startY),
    };
    setOffset(nextOffset);
    syncCrop(zoom, nextOffset);
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    syncCrop(nextZoom, offset);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          首页封面图片 <span className="text-[#B94A48]">*</span>
        </span>
        <button
          className="rounded-lg border border-[var(--lxxl-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "上传中..." : imageUrl ? "重新选择" : "选择图片"}
        </button>
      </div>
      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        type="file"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {previewUrl ? (
        <div className="space-y-3 rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
          <p className="text-xs text-[var(--lxxl-muted)]">拖动图片选择展示范围，与小程序顶部封面比例一致。</p>
          <div
            className="relative mx-auto overflow-hidden rounded-xl bg-[#1f2937]"
            style={{ width: VIEWPORT_WIDTH, height: viewportHeight, touchAction: "none" }}
            onMouseDown={(event) => handlePointerDown(event.clientX, event.clientY)}
            onMouseMove={(event) => {
              if (event.buttons === 1) {
                handlePointerMove(event.clientX, event.clientY);
              }
            }}
            onMouseUp={() => {
              dragRef.current = null;
            }}
            onMouseLeave={() => {
              dragRef.current = null;
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (touch) {
                handlePointerDown(touch.clientX, touch.clientY);
              }
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (touch) {
                handlePointerMove(touch.clientX, touch.clientY);
              }
            }}
            onTouchEnd={() => {
              dragRef.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="封面裁剪"
              className="pointer-events-none absolute max-w-none select-none"
              draggable={false}
              src={previewUrl}
              style={buildImageStyle(naturalSize, zoom, offset, VIEWPORT_WIDTH, viewportHeight)}
            />
            <div className="pointer-events-none absolute inset-0 ring-2 ring-white/70 ring-inset" />
          </div>
          <label className="block">
            <span className="text-xs font-medium text-[var(--lxxl-muted)]">缩放</span>
            <input
              className="mt-2 w-full"
              max={3}
              min={1}
              step={0.01}
              type="range"
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
            />
          </label>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-8 text-center text-sm text-[var(--lxxl-muted)]">
          请上传首页顶部封面，并在预览框内拖动选择展示范围
        </div>
      )}
      {error ? <p className="text-sm text-[#B94A48]">{error}</p> : null}
    </div>
  );
}

function resolveImageUrl(imageUrl?: string | null) {
  const value = imageUrl?.trim();
  if (!value) {
    return "";
  }
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }
  return value.startsWith("/") ? `${API_BASE_URL}${value}` : `${API_BASE_URL}/${value}`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

function buildImageStyle(
  naturalSize: { width: number; height: number },
  zoom: number,
  offset: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
) {
  if (naturalSize.width <= 0 || naturalSize.height <= 0) {
    return { display: "none" };
  }
  const baseScale = Math.max(viewportWidth / naturalSize.width, viewportHeight / naturalSize.height);
  const scale = baseScale * zoom;
  const width = naturalSize.width * scale;
  const height = naturalSize.height * scale;
  return {
    width,
    height,
    left: (viewportWidth - width) / 2 + offset.x,
    top: (viewportHeight - height) / 2 + offset.y,
  };
}
