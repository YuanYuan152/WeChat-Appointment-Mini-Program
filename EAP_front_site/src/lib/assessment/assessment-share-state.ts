export interface AssessmentPosterPayload<TBlob = Blob> {
  blob: TBlob;
  objectUrl: string;
  previewDataUrl: string;
}

export interface AssessmentPosterState<TBlob = Blob> {
  sourceKey: string;
  generation: number;
  status: "idle" | "generating" | "ready" | "error";
  poster: AssessmentPosterPayload<TBlob> | null;
  error: string | null;
}

export type AssessmentPosterAction<TBlob = Blob> =
  | {
      type: "source-changed";
      sourceKey: string;
      generation: number;
    }
  | {
      type: "generation-started";
      sourceKey: string;
      generation: number;
    }
  | {
      type: "generation-succeeded";
      sourceKey: string;
      generation: number;
      poster: AssessmentPosterPayload<TBlob>;
    }
  | {
      type: "generation-failed";
      sourceKey: string;
      generation: number;
      error: string;
    };

export function assessmentShareSourceKey(
  assessmentId: string,
  shareUrl: string | null | undefined
): string {
  return JSON.stringify([assessmentId, shareUrl?.trim() || ""]);
}

export function verifiedIncomingAssessmentShareCode(
  incomingShareCode: string | null | undefined,
  expectedShareCode: string | null | undefined
): string | null {
  const incoming = incomingShareCode?.trim() || "";
  const expected = expectedShareCode?.trim() || "";
  return incoming && expected && incoming === expected ? incoming : null;
}

export function safeAssessmentShareFileName(title: string): string {
  const normalized = title.replace(/[\\/:*?"<>|]/g, "-").trim();
  return `${normalized || "心理测评"}-分享海报.png`;
}

export interface AssessmentLinkSharePayload {
  title: string;
  text: string;
  url: string;
}

export interface AssessmentPosterSharePayload<TFile = File> {
  files: TFile[];
}

export type AssessmentShareKind = "link" | "poster";

export function createAssessmentLinkSharePayload(
  title: string,
  url: string
): AssessmentLinkSharePayload {
  return {
    title,
    text: `邀请你完成「${title}」心理测评`,
    url,
  };
}

export function createAssessmentPosterSharePayload<TFile>(
  file: TFile
): AssessmentPosterSharePayload<TFile> {
  return { files: [file] };
}

export function isWechatUserAgent(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}

function shareErrorName(reason: unknown): string | null {
  if (
    typeof reason === "object" &&
    reason !== null &&
    "name" in reason &&
    typeof reason.name === "string"
  ) {
    return reason.name;
  }
  return null;
}

export function assessmentShareErrorMessage(
  reason: unknown,
  kind: AssessmentShareKind
): string | null {
  const errorName = shareErrorName(reason);
  if (errorName === "AbortError") return null;

  const fallback =
    kind === "link"
      ? "链接分享失败，请复制链接后发送"
      : "图片分享失败，请保存海报后发送";

  if (errorName === "NotAllowedError") {
    return kind === "link"
      ? "浏览器未允许分享，请确认使用 HTTPS，或复制链接后发送"
      : "浏览器未允许图片分享，请确认使用 HTTPS，或保存海报后发送";
  }
  if (errorName === "DataError") {
    return kind === "link"
      ? "微信或当前应用无法接收该链接，请复制链接后发送"
      : "微信或当前应用无法接收该图片，请保存海报后发送";
  }
  if (errorName === "TypeError") {
    return kind === "link"
      ? "当前浏览器不支持链接分享，请复制链接后发送"
      : "当前浏览器不支持图片分享，请保存海报后发送";
  }
  return fallback;
}

export function createAssessmentPosterState<TBlob = Blob>(
  sourceKey: string
): AssessmentPosterState<TBlob> {
  return {
    sourceKey,
    generation: 0,
    status: "idle",
    poster: null,
    error: null,
  };
}

export function assessmentPosterReducer<TBlob = Blob>(
  state: AssessmentPosterState<TBlob>,
  action: AssessmentPosterAction<TBlob>
): AssessmentPosterState<TBlob> {
  if (action.type === "source-changed") {
    return {
      sourceKey: action.sourceKey,
      generation: action.generation,
      status: "idle",
      poster: null,
      error: null,
    };
  }

  if (action.type === "generation-started") {
    return {
      sourceKey: action.sourceKey,
      generation: action.generation,
      status: "generating",
      poster: null,
      error: null,
    };
  }

  if (
    action.sourceKey !== state.sourceKey ||
    action.generation !== state.generation ||
    state.status !== "generating"
  ) {
    return state;
  }

  if (action.type === "generation-succeeded") {
    return {
      ...state,
      status: "ready",
      poster: action.poster,
      error: null,
    };
  }

  return {
    ...state,
    status: "error",
    poster: null,
    error: action.error,
  };
}
