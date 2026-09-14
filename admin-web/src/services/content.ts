import { apiRequest } from "@/lib/api";
import type { Activity, Banner, SiteGuideItem, SitePage } from "@/types/api";

import type { ContentDraft, ContentKind, PaginationParams } from "@/types/app";
import { sitePageKeyForKind } from "@/components/content/ContentTabs";

function buildSiteSectionPayload(kind: "brand" | "charity" | "contact", draft: ContentDraft) {
  if (!draft.subtitle.trim()) {
    throw new Error("请填写副标题");
  }
  if (!draft.body.trim()) {
    throw new Error("请填写正文");
  }

  return {
    subtitle: draft.subtitle.trim(),
    body: draft.body,
    ...(kind === "contact"
      ? { assistant_qrcode_url: draft.assistantQrcodeUrl.trim() || null }
      : {}),
  };
}

function activityTypeForKind(kind: ContentKind) {
  return kind === "live" ? "LIVE" : "NOTICE";
}

function buildActivityPayload(draft: ContentDraft) {
  if (!draft.title.trim()) {
    throw new Error("请输入标题");
  }
  const content = (draft.summary || draft.body || "").trim();
  const coverUrl = draft.imageUrl.trim();
  const isLive = draft.kind === "live";
  if (isLive && draft.liveDisplayMode === "CALENDAR" && (!content || !coverUrl)) {
    throw new Error("图文日历需要填写预告文字并上传日历图片");
  }
  if (
    isLive
    && draft.liveDisplayMode === "CHANNELS"
    && (!draft.jixinliIconUrl.trim() || !draft.tongxinliIconUrl.trim())
  ) {
    throw new Error("请上传济心理和同心理两个视频号图标");
  }
  if (isLive && draft.liveDisplayMode === "WEB" && !draft.liveUrl.trim()) {
    throw new Error("请输入直播链接");
  }
  return {
    title: draft.title.trim(),
    content: content || undefined,
    cover_url: isLive && draft.liveDisplayMode === "CHANNELS" ? "" : coverUrl || undefined,
    link_url: isLive
      ? draft.liveDisplayMode === "WEB"
        ? draft.liveUrl.trim()
        : ""
      : undefined,
    live_display_mode: isLive ? draft.liveDisplayMode : undefined,
    jixinli_icon_url: isLive
      ? draft.liveDisplayMode === "CHANNELS"
        ? draft.jixinliIconUrl.trim()
        : ""
      : undefined,
    tongxinli_icon_url: isLive
      ? draft.liveDisplayMode === "CHANNELS"
        ? draft.tongxinliIconUrl.trim()
        : ""
      : undefined,
    type: activityTypeForKind(draft.kind),
    is_active: true,
  };
}

function bannerPayload(draft: ContentDraft) {
  if (!draft.title.trim()) {
    throw new Error("请输入标题");
  }
  if (!draft.imageUrl.trim()) {
    throw new Error("请上传 Banner 图片");
  }
  if (draft.bannerLinkType !== "NONE" && !draft.bannerLinkValue.trim()) {
    throw new Error("请输入 Banner 跳转地址");
  }
  if (
    draft.bannerLinkType === "URL"
    && !/^https:\/\/[^\s]+$/i.test(draft.bannerLinkValue.trim())
  ) {
    throw new Error("外部网址必须是完整的 HTTPS 地址");
  }
  return {
    title: draft.title.trim(),
    image_url: draft.imageUrl.trim(),
    link_type: draft.bannerLinkType,
    link_value: draft.bannerLinkType === "NONE" ? "" : draft.bannerLinkValue.trim(),
    is_active: true,
  };
}

export async function fetchContentData(kind: ContentKind, _articlePagination: PaginationParams) {
  if (kind === "banner") {
    const banners = await apiRequest<Banner[]>("/api/mini/ops/banners/manage");
    return { banners };
  }

  if (kind === "activity" || kind === "live") {
    const activities = await apiRequest<Activity[]>("/api/mini/ops/activities/manage");
    const filtered =
      kind === "live"
        ? activities.filter((item) => (item.Type || "").toUpperCase() === "LIVE")
        : activities.filter((item) => (item.Type || "").toUpperCase() !== "LIVE");
    return { activities: filtered };
  }

  if (kind === "brand" || kind === "charity" || kind === "contact" || kind === "home_cover") {
    const sitePages = await apiRequest<SitePage[]>("/api/mini/ops/site-pages/manage");
    const pageKey = sitePageKeyForKind(kind);
    return { sitePages: sitePages.filter((page) => page.pageKey === pageKey) };
  }

  const siteGuideItems = await apiRequest<SiteGuideItem[]>("/api/mini/ops/site-guide-items/manage");
  return { siteGuideItems };
}

export function createContent(draft: ContentDraft) {
  if (draft.kind === "banner") {
    return apiRequest("/api/mini/ops/banners", {
      method: "POST",
      body: JSON.stringify(bannerPayload(draft)),
    });
  }

  if (draft.kind === "activity" || draft.kind === "live") {
    return apiRequest("/api/mini/ops/activities", {
      method: "POST",
      body: JSON.stringify(buildActivityPayload(draft)),
    });
  }

  if (draft.kind === "home_cover") {
    const pageKey = sitePageKeyForKind(draft.kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    if (!draft.coverImageUrl.trim()) {
      throw new Error("请上传首页封面图片");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify({
        title: draft.title.trim() || "同心理",
        body: draft.body.trim() || "专业.温暖的心理服务平台",
        cover_image_url: draft.coverImageUrl.trim(),
        cover_crop: draft.coverCrop,
      }),
    });
  }

  if (draft.kind === "brand" || draft.kind === "charity" || draft.kind === "contact") {
    const pageKey = sitePageKeyForKind(draft.kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify(buildSiteSectionPayload(draft.kind, draft)),
    });
  }

  if (!draft.title.trim()) {
    throw new Error("请填写主题");
  }
  if (!draft.body.trim()) {
    throw new Error("请填写正文");
  }
  return apiRequest("/api/mini/ops/site-guide-items", {
    method: "POST",
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
    }),
  });
}

export function updateContent(kind: ContentKind, id: number, draft: ContentDraft) {
  if (kind === "banner") {
    return apiRequest(`/api/mini/ops/banners/${id}`, {
      method: "PUT",
      body: JSON.stringify(bannerPayload(draft)),
    });
  }

  if (kind === "activity" || kind === "live") {
    return apiRequest(`/api/mini/ops/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify(buildActivityPayload({ ...draft, kind })),
    });
  }

  if (kind === "home_cover") {
    const pageKey = sitePageKeyForKind(kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    if (!draft.coverImageUrl.trim()) {
      throw new Error("请上传首页封面图片");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify({
        title: draft.title.trim() || "同心理",
        body: draft.body.trim() || "专业.温暖的心理服务平台",
        cover_image_url: draft.coverImageUrl.trim(),
        cover_crop: draft.coverCrop,
      }),
    });
  }

  if (kind === "brand" || kind === "charity" || kind === "contact") {
    const pageKey = sitePageKeyForKind(kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify(buildSiteSectionPayload(kind, draft)),
    });
  }

  if (!draft.title.trim()) {
    throw new Error("请填写主题");
  }
  if (!draft.body.trim()) {
    throw new Error("请填写正文");
  }
  return apiRequest(`/api/mini/ops/site-guide-items/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
    }),
  });
}

export function deleteContent(kind: ContentKind, id: number) {
  if (kind === "banner") {
    return apiRequest(`/api/mini/ops/banners/${id}`, { method: "DELETE" });
  }
  if (kind === "activity" || kind === "live") {
    return apiRequest(`/api/mini/ops/activities/${id}`, { method: "DELETE" });
  }
  if (kind === "consultation_guide") {
    return apiRequest(`/api/mini/ops/site-guide-items/${id}`, { method: "DELETE" });
  }
  throw new Error("该类型内容不支持删除");
}
