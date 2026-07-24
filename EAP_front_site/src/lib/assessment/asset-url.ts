const MAX_ASSET_REF_LENGTH = 500;
const RASTER_IMAGE_EXTENSION = /\.(?:gif|jpe?g|png|webp)$/i;
const SAFE_PATH_CHARACTERS = /^\/[A-Za-z0-9._/-]+$/;
const CONTROLLED_ASSET_PATH =
  /^\/static\/assessment-assets\/[0-9a-f]{64}\.(?:jpg|png|webp)$/;

const EAP_LOCAL_PREFIXES = ["/images/"] as const;
const API_LEGACY_PREFIXES = ["/static/assessments/"] as const;

export interface AssessmentAssetUrlOptions {
  /**
   * Override the public API base URL. Tests and server-side callers should pass
   * this explicitly; browser components normally use NEXT_PUBLIC_API_BASE_URL.
   */
  apiBaseUrl?: string | null;
  /**
   * Current EAP/browser origin, used only to display historical absolute
   * `/images/**` references from that exact origin.
   */
  sameOriginBaseUrl?: string | null;
}

function isSafeRasterPath(
  value: string,
  prefixes: readonly string[],
): boolean {
  if (
    value.length > MAX_ASSET_REF_LENGTH ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("//") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("%") ||
    !SAFE_PATH_CHARACTERS.test(value) ||
    !RASTER_IMAGE_EXTENSION.test(value)
  ) {
    return false;
  }

  const segments = value.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }

  return prefixes.some((prefix) => value.startsWith(prefix));
}

function isSafeApiAssetPath(value: string): boolean {
  return (
    CONTROLLED_ASSET_PATH.test(value) ||
    isSafeRasterPath(value, API_LEGACY_PREFIXES)
  );
}

function normalizeHttpOrigin(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve an image reference from assessment JSON without trusting arbitrary
 * URL schemes or remote hosts.
 *
 * - `/images/**` is bundled with EAP and remains same-origin.
 * - Controlled `/static/**` assessment assets are served by the configured API.
 * - Historical absolute URLs are accepted only when they use that exact API
 *   origin and one of the controlled assessment paths.
 */
export function resolveAssessmentAssetUrl(
  source: string | null | undefined,
  options: AssessmentAssetUrlOptions = {},
): string | null {
  const value = source?.trim() ?? "";
  if (!value || value.length > MAX_ASSET_REF_LENGTH) {
    return null;
  }

  if (isSafeRasterPath(value, EAP_LOCAL_PREFIXES)) {
    return value;
  }

  const configuredApiUrl =
    options.apiBaseUrl === undefined
      ? process.env.NEXT_PUBLIC_API_BASE_URL
      : options.apiBaseUrl;
  const apiBaseUrl = normalizeHttpOrigin(configuredApiUrl);
  if (isSafeApiAssetPath(value)) {
    return apiBaseUrl ? new URL(value, apiBaseUrl).toString() : null;
  }

  let absolute: URL;
  try {
    absolute = new URL(value);
  } catch {
    return null;
  }

  const sameOriginBaseUrl = normalizeHttpOrigin(options.sameOriginBaseUrl);
  if (
    sameOriginBaseUrl &&
    absolute.origin === sameOriginBaseUrl &&
    !absolute.username &&
    !absolute.password &&
    !absolute.search &&
    !absolute.hash &&
    isSafeRasterPath(absolute.pathname, EAP_LOCAL_PREFIXES)
  ) {
    return absolute.pathname;
  }

  if (
    !apiBaseUrl ||
    absolute.origin !== apiBaseUrl ||
    absolute.username ||
    absolute.password ||
    absolute.search ||
    absolute.hash ||
    !isSafeApiAssetPath(absolute.pathname)
  ) {
    return null;
  }

  return absolute.toString();
}
