"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import { isSafeAssessmentAssetReference } from "@/lib/assessmentEditor";
import { resolveAssessmentAssetUrl } from "@/lib/assessmentReport";
import {
  getAssessmentImageUploadError,
  uploadAssessmentImage,
} from "@/services/uploads";

export function AssessmentImageField({
  value,
  onChange,
  onUploadStateChange,
  disabled = false,
  required = false,
  compact = false,
  aspect = "cover",
  helpText,
  inputLabel = "图片地址",
  placeholder = "/static/assessment-assets/...",
}: {
  value: string;
  onChange: (value: string) => void;
  onUploadStateChange: (delta: number) => void;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  aspect?: "cover" | "result";
  helpText?: string;
  inputLabel?: string;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const previewUrl = useMemo(
    () =>
      resolveAssessmentAssetUrl(value, {
        apiBaseUrl: API_BASE_URL,
        eapBaseUrl: process.env.NEXT_PUBLIC_EAP_BASE_URL,
      }),
    [value],
  );
  const [previewState, setPreviewState] = useState<
    "empty" | "loading" | "loaded" | "failed"
  >(previewUrl ? "loading" : "empty");

  useEffect(() => {
    if (!previewUrl) {
      setPreviewState("empty");
      return;
    }
    let active = true;
    const preview = new window.Image();
    setPreviewState("loading");
    preview.onload = () => {
      if (active) {
        setPreviewState("loaded");
      }
    };
    preview.onerror = () => {
      if (active) {
        setPreviewState("failed");
      }
    };
    preview.src = previewUrl;
    return () => {
      active = false;
      preview.onload = null;
      preview.onerror = null;
    };
  }, [previewUrl]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  async function handleFile(file: File | undefined) {
    if (!file || uploading || disabled) {
      return;
    }
    const validationError = getAssessmentImageUploadError(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadError("");
    onUploadStateChange(1);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);
    try {
      const result = await uploadAssessmentImage(file, controller.signal);
      if (!isSafeAssessmentAssetReference(result.path)) {
        throw new Error("上传接口返回了不受信任的图片地址");
      }
      onChange(result.path);
    } catch (error) {
      setUploadError(
        timedOut
          ? "图片上传超时，请检查网络后重试"
          : controller.signal.aborted
            ? "已取消图片上传"
            : error instanceof Error
              ? error.message
              : "图片上传失败，请稍后重试",
      );
    } finally {
      window.clearTimeout(timeout);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setUploading(false);
      onUploadStateChange(-1);
    }
  }

  const inputClass = compact
    ? "h-9 min-w-0 flex-1 rounded-lg border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:bg-[#F7F5F2] disabled:text-[var(--lxxl-muted)]"
    : "h-11 min-w-0 flex-1 rounded-xl border border-[var(--lxxl-border)] bg-white px-4 text-sm outline-none transition focus:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:bg-[#F7F5F2] disabled:text-[var(--lxxl-muted)]";
  const buttonClass = compact
    ? "h-9 shrink-0 rounded-lg border border-[var(--lxxl-green)] px-3 text-xs font-medium text-[var(--lxxl-green)] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40"
    : "h-11 shrink-0 rounded-xl border border-[var(--lxxl-green)] px-4 text-sm font-medium text-[var(--lxxl-green)] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 gap-2">
        <input
          aria-label={inputLabel}
          aria-invalid={Boolean(uploadError)}
          className={inputClass}
          disabled={disabled || uploading}
          maxLength={500}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={(event) => {
            setUploadError("");
            onChange(event.target.value);
          }}
        />
        <button
          className={buttonClass}
          disabled={disabled && !uploading}
          type="button"
          onClick={() => {
            if (uploading) {
              abortControllerRef.current?.abort();
              return;
            }
            fileInputRef.current?.click();
          }}
        >
          {uploading ? "取消上传" : value ? "替换图片" : "上传图片"}
        </button>
        {!required && value && (
          <button
            aria-label="移除图片"
            className={buttonClass}
            disabled={disabled || uploading}
            title="移除图片"
            type="button"
            onClick={() => {
              setUploadError("");
              onChange("");
            }}
          >
            移除
          </button>
        )}
        <input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void handleFile(file);
          }}
        />
      </div>

      <div
        aria-label={previewState === "loaded" ? "图片预览" : "暂无有效图片预览"}
        className={`relative overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-[#F4F1EB] ${
          aspect === "cover" ? "aspect-[2/1]" : "aspect-video"
        }`}
        role="img"
        style={
          previewUrl && previewState === "loaded"
            ? {
                backgroundImage: `url(${JSON.stringify(previewUrl)})`,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        {previewState !== "loaded" && (
          <span className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-[var(--lxxl-muted)]">
            {previewState === "loading"
              ? "图片加载中..."
              : previewState === "failed"
                ? "图片无法加载，请确认地址或重新上传"
                : value
                  ? "当前地址不在可信图片范围内"
                  : "上传后可在这里预览"}
          </span>
        )}
      </div>

      <p className="text-xs leading-5 text-[var(--lxxl-muted)]">
        {helpText || "支持 JPEG、PNG、WebP，单张不超过 5MB；也可填写系统内置图片地址。"}
      </p>
      {uploadError && (
        <p aria-live="polite" className="text-xs leading-5 text-[#A13F37]">
          {uploadError}
        </p>
      )}
    </div>
  );
}
