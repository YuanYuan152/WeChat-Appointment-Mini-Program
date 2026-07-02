import type { Dispatch, FormEvent, SetStateAction } from "react";

import { getContentKindLabel } from "@/components/content/ContentTabs";
import type { ContentDraft, ContentKind } from "@/types/app";

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
  const actionText = mode === "edit" ? "修改" : "新建";
  const canSubmit = draft.title.trim() && (activeKind !== "banner" || draft.imageUrl.trim());

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
        aria-label={`${actionText}${title}`}
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">{actionText}{title}</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            {mode === "edit" ? "保存后会更新当前内容。" : "填写后会创建到当前内容类型下。"}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-sm font-medium">
              标题 <span className="text-[#B94A48]">*</span>
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
              placeholder="请输入标题"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          {activeKind !== "banner" && (
            <label className="block">
              <span className="text-sm font-medium">摘要/正文</span>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder="请输入摘要或正文"
                value={draft.summary}
                onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">
              图片地址{activeKind === "banner" && <span className="ml-1 text-[#B94A48]">*</span>}
            </span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
              placeholder={activeKind === "banner" ? "请输入 Banner 图片地址" : "请输入图片地址"}
              value={draft.imageUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
            />
          </label>
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
