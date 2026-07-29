const DEFAULT_PUBLIC_SITE_ORIGIN = "https://eap.ji-psy.com";
const ASSESSMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSecureOrigin(value: string | null | undefined): URL | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return new URL(parsed.origin);
  } catch {
    return null;
  }
}

/**
 * Public URLs embedded in canonical/Open Graph metadata must never inherit a
 * local HTTP API address. An invalid deployment value deliberately falls back
 * to the production HTTPS origin.
 */
export function assessmentPublicSiteOrigin(
  configuredOrigin: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): URL {
  return (
    parseSecureOrigin(configuredOrigin) ??
    (parseSecureOrigin(DEFAULT_PUBLIC_SITE_ORIGIN) as URL)
  );
}

export function assessmentCanonicalUrl(
  category: "professional" | "fun",
  assessmentId: string,
  configuredOrigin?: string | null,
): URL {
  if (!ASSESSMENT_ID_PATTERN.test(assessmentId)) {
    throw new TypeError("量表 ID 无法用于公开链接");
  }
  return new URL(
    `/assessment/${category}/${assessmentId}`,
    assessmentPublicSiteOrigin(configuredOrigin),
  );
}

/**
 * Convert a trusted relative asset or already-resolved absolute asset into an
 * HTTPS-only metadata image. Unknown schemes and HTTP API images fall back to
 * the bundled EAP cover so crawlers never receive an unsafe image URL.
 */
export function assessmentMetadataImageUrl(
  resolvedCover: string | null | undefined,
  configuredOrigin?: string | null,
): URL {
  const siteOrigin = assessmentPublicSiteOrigin(configuredOrigin);
  const fallback = new URL(
    "/images/content/assess-color-cover.jpg",
    siteOrigin,
  );
  const normalized = resolvedCover?.trim();
  if (!normalized) return fallback;

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return new URL(normalized, siteOrigin);
  }

  try {
    const parsed = new URL(normalized);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}
