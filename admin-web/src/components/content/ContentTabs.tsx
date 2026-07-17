import type { ContentKind } from "@/types/app";

export const CONTENT_TABS: Array<{ kind: ContentKind; label: string }> = [
  { kind: "banner", label: "Banner" },
  { kind: "activity", label: "活动公告" },
  { kind: "article", label: "文章" },
];

export function getContentKindLabel(kind: ContentKind) {
  return CONTENT_TABS.find((tab) => tab.kind === kind)?.label ?? "内容";
}

export function ContentTabs({
  activeKind,
  onChange,
}: {
  activeKind: ContentKind;
  onChange: (kind: ContentKind) => void;
}) {
  return (
    <div className="border-b border-[var(--lxxl-border)] bg-white px-6 pt-4">
      <div className="-mb-px flex flex-wrap gap-2">
        {CONTENT_TABS.map((tab) => {
          const isActive = tab.kind === activeKind;

          return (
            <button
              key={tab.kind}
              className={`rounded-t-xl border px-6 py-3 text-sm font-medium transition ${
                isActive
                  ? "border-[var(--lxxl-border)] border-b-white bg-white text-[var(--lxxl-green)]"
                  : "border-transparent bg-[#FAF8F4] text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]"
              }`}
              type="button"
              onClick={() => onChange(tab.kind)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
