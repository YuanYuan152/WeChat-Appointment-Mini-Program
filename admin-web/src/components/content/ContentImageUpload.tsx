"use client";

import { useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import { uploadImage } from "@/services/uploads";

export function ContentImageUpload({
  value,
  onChange,
  required = false,
  label = "图片",
}: {
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const previewUrl = resolveImageUrl(value);

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
      onChange(result.url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="ml-1 text-[#B94A48]">*</span>}
        </span>
        <button
          className="rounded-lg border border-[var(--lxxl-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "上传中..." : value ? "重新选择" : "选择图片"}
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
        <div className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="预览" className="max-h-48 w-full object-contain" src={previewUrl} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-8 text-center text-sm text-[var(--lxxl-muted)]">
          请从本地选择图片上传
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
