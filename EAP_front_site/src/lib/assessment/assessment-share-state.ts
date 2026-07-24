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
