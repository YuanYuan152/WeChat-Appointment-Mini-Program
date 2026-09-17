import type { Dispatch, FormEvent, SetStateAction } from "react";

import { ContentCoverCropUpload } from "@/components/content/ContentCoverCropUpload";
import { ContentImageUpload } from "@/components/content/ContentImageUpload";
import { getContentKindLabel, isSitePageKind } from "@/components/content/ContentTabs";
import type { ContentDraft, ContentKind } from "@/types/app";

function canSubmitDraft(activeKind: ContentKind, draft: ContentDraft) {
  if (activeKind === "banner") {
    return Boolean(
      draft.title.trim()
      && draft.imageUrl.trim()
      && (draft.bannerLinkType === "NONE" || draft.bannerLinkValue.trim()),
    );
  }
  if (activeKind === "activity") {
    return Boolean(draft.title.trim());
  }
  if (activeKind === "live") {
    if (!draft.title.trim()) return false;
    if (draft.liveDisplayMode === "CALENDAR") {
      return Boolean(draft.summary.trim() && draft.imageUrl.trim());
    }
    if (draft.liveDisplayMode === "CHANNELS") {
      return Boolean(draft.jixinliIconUrl.trim() && draft.tongxinliIconUrl.trim());
    }
    return Boolean(draft.liveUrl.trim());
  }
  if (activeKind === "home_cover") {
    return draft.coverImageUrl.trim();
  }
  if (activeKind === "brand" || activeKind === "charity" || activeKind === "contact") {
    return draft.subtitle.trim() && draft.body.trim();
  }
  if (activeKind === "consultation_guide") {
    return draft.title.trim() && draft.body.trim();
  }
  return false;
}

export function ContentCreateModal({
  open,
  activeKind,
  draft,
  setDraft,
  onClose,
  onCreate,
  mode = "create",
}: {
  open: boolean;
  activeKind: ContentKind;
  draft: ContentDraft;
  setDraft: Dispatch<SetStateAction<ContentDraft>>;
  onClose: () => void;
  onCreate: () => Promise<void> | void;
  mode?: "create" | "edit";
}) {
  if (!open) {
    return null;
  }

  const title = getContentKindLabel(activeKind);
  const isSiteSectionPage =
    activeKind === "brand" || activeKind === "charity" || activeKind === "contact";
  const actionText = mode === "edit" ? "保存" : isSitePageKind(activeKind) ? "保存" : "新建";
  const modalTitle = mode === "edit" ? `修改${title}` : `${actionText}${title}`;
  const canSubmit = canSubmitDraft(activeKind, draft);
  const showTitleField =
    activeKind === "banner" ||
    activeKind === "activity" ||
    activeKind === "live" ||
    activeKind === "consultation_guide" ||
    activeKind === "home_cover";
  const titleLabel =
    activeKind === "consultation_guide" ? "主题" : activeKind === "home_cover" ? "品牌标题" : "标题";
  const bodyLabel =
    activeKind === "consultation_guide"
      ? "正文"
      : activeKind === "home_cover"
        ? "副标题"
        : activeKind === "live"
          ? "预告文字"
          : "正文";
  const showSubtitleField = isSiteSectionPage;
  const showBodyField =
    activeKind === "activity" ||
    activeKind === "live" ||
    activeKind === "home_cover" ||
    isSiteSectionPage ||
    activeKind === "consultation_guide";
  const showImageField =
    activeKind === "banner"
    || activeKind === "activity"
    || (activeKind === "live" && draft.liveDisplayMode !== "CHANNELS");
  const showLiveUrlField = activeKind === "live" && draft.liveDisplayMode === "WEB";
  const showChannelIconFields = activeKind === "live" && draft.liveDisplayMode === "CHANNELS";
  const showAssistantQrcodeField = activeKind === "contact";
  const showHomeCoverField = activeKind === "home_cover";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onCreate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 py-6">
      <form
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-xl"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">{modalTitle}</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            {activeKind === "live"
              ? "保存后会展示在小程序首页「最新动态 → 直播预告」，可选择图文日历、视频号入口或普通链接。"
              : mode === "edit"
                ? "保存后会同步到小程序前端。"
                : "保存后会创建并同步到小程序前端。"}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          {showTitleField && (
            <label className="block">
              <span className="text-sm font-medium">
                {titleLabel}
                {activeKind !== "home_cover" && <span className="ml-1 text-[#B94A48]">*</span>}
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder={
                  activeKind === "home_cover"
                    ? "同心理"
                    : activeKind === "consultation_guide"
                      ? "请输入主题"
                      : activeKind === "live"
                        ? "请输入直播预告标题"
                        : "请输入标题"
                }
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
          )}

          {showSubtitleField && (
            <label className="block">
              <span className="text-sm font-medium">
                副标题
                <span className="ml-1 text-[#B94A48]">*</span>
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder="例如：同心理 · 专业.温暖的心理服务平台"
                value={draft.subtitle}
                onChange={(event) => setDraft((prev) => ({ ...prev, subtitle: event.target.value }))}
              />
            </label>
          )}

          {activeKind === "banner" && (
            <>
              <label className="block">
                <span className="text-sm font-medium">点击跳转</span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                  value={draft.bannerLinkType}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      bannerLinkType: event.target.value as ContentDraft["bannerLinkType"],
                    }))
                  }
                >
                  <option value="NONE">不跳转</option>
                  <option value="PAGE">小程序页面</option>
                  <option value="URL">外部网址</option>
                </select>
              </label>
              {draft.bannerLinkType !== "NONE" && (
                <label className="block">
                  <span className="text-sm font-medium">
                    跳转地址<span className="ml-1 text-[#B94A48]">*</span>
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                    placeholder={
                      draft.bannerLinkType === "URL"
                        ? "https://example.com"
                        : "/pages/consultant/list"
                    }
                    type={draft.bannerLinkType === "URL" ? "url" : "text"}
                    value={draft.bannerLinkValue}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, bannerLinkValue: event.target.value }))
                    }
                  />
                </label>
              )}
            </>
          )}

          {activeKind === "live" && (
            <label className="block">
              <span className="text-sm font-medium">展示类型</span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                value={draft.liveDisplayMode}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    liveDisplayMode: event.target.value as ContentDraft["liveDisplayMode"],
                  }))
                }
              >
                <option value="CALENDAR">图文日历（无跳转）</option>
                <option value="CHANNELS">视频号入口</option>
                <option value="WEB">普通直播链接</option>
              </select>
            </label>
          )}

          {showBodyField && (
            <label className="block">
              <span className="text-sm font-medium">
                {bodyLabel}
                {(activeKind === "brand" ||
                  activeKind === "charity" ||
                  activeKind === "contact" ||
                  activeKind === "consultation_guide" ||
                  (activeKind === "live" && draft.liveDisplayMode === "CALENDAR")) && (
                  <span className="ml-1 text-[#B94A48]">*</span>
                )}
              </span>
              <textarea
                className={
                  activeKind === "home_cover"
                    ? "mt-2 min-h-20 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                    : "mt-2 min-h-40 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                }
                placeholder={
                  activeKind === "live"
                    ? draft.liveDisplayMode === "CALENDAR"
                      ? "请输入直播预告文字（必填）"
                      : "请输入直播预告文字（可选）"
                    : activeKind === "activity"
                      ? "请输入活动正文"
                      : activeKind === "home_cover"
                        ? "专业.温暖的心理服务平台"
                        : "请输入正文：段内换行按一次回车；段落之间空一行"
                }
                value={
                  activeKind === "activity" || activeKind === "live"
                    ? draft.summary
                    : activeKind === "brand" ||
                        activeKind === "charity" ||
                        activeKind === "contact" ||
                        activeKind === "home_cover" ||
                        activeKind === "consultation_guide"
                      ? draft.body
                      : draft.summary
                }
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    activeKind === "brand" ||
                    activeKind === "charity" ||
                    activeKind === "contact" ||
                    activeKind === "home_cover" ||
                    activeKind === "consultation_guide"
                  ) {
                    setDraft((prev) => ({ ...prev, body: value }));
                  } else {
                    setDraft((prev) => ({ ...prev, summary: value }));
                  }
                }}
              />
            </label>
          )}

          {showLiveUrlField && (
            <label className="block">
              <span className="text-sm font-medium">直播链接</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                type="url"
                placeholder="请输入直播链接，例如 https://..."
                value={draft.liveUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, liveUrl: event.target.value }))}
              />
            </label>
          )}

          {showChannelIconFields && (
            <>
              <ContentImageUpload
                label="济心理视频号图标"
                required
                value={draft.jixinliIconUrl}
                onChange={(url) => setDraft((prev) => ({ ...prev, jixinliIconUrl: url }))}
              />
              <ContentImageUpload
                label="同心理视频号图标"
                required
                value={draft.tongxinliIconUrl}
                onChange={(url) => setDraft((prev) => ({ ...prev, tongxinliIconUrl: url }))}
              />
            </>
          )}

          {showHomeCoverField && (
            <ContentCoverCropUpload
              crop={draft.coverCrop}
              imageUrl={draft.coverImageUrl}
              onChange={({ imageUrl, crop }) =>
                setDraft((prev) => ({
                  ...prev,
                  coverImageUrl: imageUrl,
                  coverCrop: crop,
                }))
              }
            />
          )}

          {showAssistantQrcodeField && (
            <ContentImageUpload
              label="助理微信二维码"
              value={draft.assistantQrcodeUrl}
              onChange={(url) => setDraft((prev) => ({ ...prev, assistantQrcodeUrl: url }))}
            />
          )}

          {showImageField && (
            <ContentImageUpload
              label={
                activeKind === "banner"
                  ? "Banner 图片"
                  : activeKind === "live" && draft.liveDisplayMode === "CALENDAR"
                    ? "直播日历图片"
                    : activeKind === "live"
                    ? "封面图片（可选）"
                    : "封面图片"
              }
              required={
                activeKind === "banner"
                || (activeKind === "live" && draft.liveDisplayMode === "CALENDAR")
              }
              value={draft.imageUrl}
              onChange={(url) => setDraft((prev) => ({ ...prev, imageUrl: url }))}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <button
            className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
            type="submit"
            disabled={!canSubmit}
          >
            {actionText}
          </button>
        </div>
      </form>
    </div>
  );
}
