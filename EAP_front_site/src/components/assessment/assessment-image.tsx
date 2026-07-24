"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { resolveAssessmentAssetUrl } from "@/lib/assessment/asset-url";
import { cn } from "@/lib/utils";

interface AssessmentImageProps {
  source: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  sizes: string;
  priority?: boolean;
}

const subscribeToBrowserOrigin = () => () => {};
const getBrowserOrigin = () => window.location.origin;
const getServerOrigin = () => null;

export function AssessmentImage({
  source,
  alt,
  className,
  fallbackClassName,
  sizes,
  priority = false,
}: AssessmentImageProps) {
  const sameOriginBaseUrl = useSyncExternalStore(
    subscribeToBrowserOrigin,
    getBrowserOrigin,
    getServerOrigin,
  );
  const resolvedSource = resolveAssessmentAssetUrl(source, {
    sameOriginBaseUrl,
  });
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const unavailable = !resolvedSource || failedSource === resolvedSource;

  if (unavailable) {
    return (
      <div
        aria-label={`${alt}图片暂不可用`}
        className={cn(
          "absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 via-muted to-secondary/15 text-muted-foreground",
          fallbackClassName,
        )}
        role="img"
      >
        <ImageOff aria-hidden="true" className="h-8 w-8 opacity-55" />
      </div>
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      fill
      priority={priority}
      sizes={sizes}
      src={resolvedSource}
      onError={() => setFailedSource(resolvedSource)}
    />
  );
}
