import type { Metadata } from "next";
import type { Assessment } from "@/lib/api/types";
import { resolveAssessmentAssetUrl } from "@/lib/assessment/asset-url";
import {
  assessmentCanonicalUrl,
  assessmentMetadataImageUrl,
  assessmentPublicSiteOrigin,
} from "@/lib/assessment/public-url";

type AssessmentCategory = "professional" | "fun";

function metadataDescription(assessment: Assessment): string {
  const source =
    assessment.description?.trim() ||
    assessment.subtitle?.trim() ||
    `完成「${assessment.title}」心理测评，了解自己当下的状态。`;
  const normalized = source.replace(/\s+/g, " ");
  return normalized.length > 180
    ? `${normalized.slice(0, 179).trimEnd()}…`
    : normalized;
}

export function buildAssessmentMetadata(
  assessment: Assessment,
  category: AssessmentCategory,
): Metadata {
  const siteOrigin = assessmentPublicSiteOrigin();
  const canonical = assessmentCanonicalUrl(
    category,
    assessment.id,
    siteOrigin.toString(),
  );
  const resolvedCover = resolveAssessmentAssetUrl(assessment.cover, {
    sameOriginBaseUrl: siteOrigin.toString(),
  });
  const cover = assessmentMetadataImageUrl(
    resolvedCover,
    siteOrigin.toString(),
  );
  const title = `${assessment.title} | 连心心理`;
  const description = metadataDescription(assessment);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "连心心理",
      title,
      description,
      url: canonical,
      images: [
        {
          url: cover,
          alt: `${assessment.title}量表封面`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [cover],
    },
  };
}

export const missingAssessmentMetadata: Metadata = {
  title: "量表不存在 | 连心心理",
  description: "该心理测评不存在或暂未发布。",
  robots: {
    index: false,
    follow: false,
  },
};
