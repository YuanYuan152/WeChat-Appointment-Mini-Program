"use client";

import { useMemo, useState } from "react";

import { DataCard, EmptyHint, GhostButton, TagChip } from "@/components/enterpriseData/ui";
import { chinaDateTimeText, tagColor, tagUsage } from "@/lib/enterpriseData";
import type { EnterpriseAnnotation, EnterpriseDataset, EnterpriseTagGroup } from "@/types/enterpriseData";

const GROUP_COLORS = ["#C26A0A", "#1E4C9A", "#1F8F68", "#7A4FA3", "#B3261E", "#3D5A4E", "#8F6A1F", "#4A5A78"];

export function TagsTab({
  dataset,
  saving,
  onSave,
  onOpenRespondent,
}: {
  dataset: EnterpriseDataset;
  saving: boolean;
  onSave: (groups: EnterpriseTagGroup[]) => Promise<void>;
  onOpenRespondent: (key: string) => void;
}) {
  const [groups, setGroups] = useState<EnterpriseTagGroup[]>(dataset.tagLibrary);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);
  const usage = useMemo(() => tagUsage(dataset.respondents), [dataset.respondents]);
  const usageList = useMemo(() => [...usage.entries()].sort((left, right) => right[1] - left[1]), [usage]);
  const maxUsage = usageList[0]?.[1] || 1;

  // 父组件以标签库内容作为 key，保存成功后会重新挂载，草稿自然重置。
  const update = (next: EnterpriseTagGroup[]) => {
    setGroups(next);
    setDirty(true);
  };

  const addTag = (index: number) => {
    const value = (drafts[index] || "").trim().slice(0, 20);
    if (!value) return;
    const group = groups[index];
    if (group.tags.includes(value)) {
      setDrafts((current) => ({ ...current, [index]: "" }));
      return;
    }
    update(groups.map((item, itemIndex) => (itemIndex === index ? { ...item, tags: [...item.tags, value] } : item)));
    setDrafts((current) => ({ ...current, [index]: "" }));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <DataCard
        right={
          <>
            {dirty && (
              <GhostButton
                onClick={() => {
                  setGroups(dataset.tagLibrary);
                  setDirty(false);
                }}
              >
                撤销修改
              </GhostButton>
            )}
            <GhostButton
              disabled={!dirty || saving}
              tone="primary"
              onClick={() => {
                void onSave(groups).then(() => setDirty(false)).catch(() => undefined);
              }}
            >
              {saving ? "正在保存..." : "保存标签库"}
            </GhostButton>
          </>
        }
        sub="仅对当前企业生效；修改标签库不会改动已打在员工身上的标签"
        title="标注标签库"
      >
        <div className="space-y-4">
          {groups.map((group, index) => (
            <div key={`${group.name}-${index}`} className="rounded-xl border border-[var(--lxxl-border)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  aria-label="分组名称"
                  className="h-9 w-40 rounded-lg border border-[var(--lxxl-border)] px-3 text-sm font-medium outline-none focus:border-[var(--lxxl-green)]"
                  maxLength={20}
                  value={group.name}
                  onChange={(event) =>
                    update(groups.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))
                  }
                />
                <div className="flex items-center gap-1.5">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={`分组颜色 ${color}`}
                      className={`h-5 w-5 rounded-full border-2 ${group.color.toUpperCase() === color ? "border-[var(--lxxl-text)]" : "border-white"}`}
                      style={{ background: color }}
                      type="button"
                      onClick={() =>
                        update(groups.map((item, itemIndex) => (itemIndex === index ? { ...item, color } : item)))
                      }
                    />
                  ))}
                </div>
                <button
                  className="ml-auto text-xs font-medium text-[#A13F37] hover:text-[#7F2F29]"
                  type="button"
                  onClick={() => {
                    if (group.tags.length > 0 && !window.confirm(`删除分组“${group.name}”及其 ${group.tags.length} 个标签？`)) return;
                    update(groups.filter((_, itemIndex) => itemIndex !== index));
                  }}
                >
                  删除分组
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {group.tags.map((tag) => (
                  <TagChip
                    key={tag}
                    color={group.color}
                    tag={tag}
                    onRemove={() =>
                      update(
                        groups.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, tags: item.tags.filter((value) => value !== tag) } : item,
                        ),
                      )
                    }
                  />
                ))}
                <input
                  aria-label={`为${group.name}新增标签`}
                  className="h-7 w-32 rounded-md border border-dashed border-[var(--lxxl-border)] px-2 text-xs outline-none focus:border-[var(--lxxl-green)]"
                  maxLength={20}
                  placeholder="+ 新标签，回车添加"
                  value={drafts[index] || ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [index]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag(index);
                    }
                  }}
                />
              </div>
            </div>
          ))}
          <button
            className="h-10 w-full rounded-xl border border-dashed border-[var(--lxxl-border)] text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)] disabled:opacity-50"
            disabled={groups.length >= 12}
            type="button"
            onClick={() =>
              update([
                ...groups,
                { name: `新分组${groups.length + 1}`, color: GROUP_COLORS[groups.length % GROUP_COLORS.length], tags: [] },
              ])
            }
          >
            + 新建标签分组
          </button>
        </div>
      </DataCard>

      <div className="space-y-5">
        <DataCard sub="当前带有该标签的员工人数" title="标签使用情况">
          {usageList.length === 0 ? (
            <EmptyHint text="还没有员工被打上标签，可在员工档案中添加标注" />
          ) : (
            <div className="space-y-2.5">
              {usageList.slice(0, 12).map(([tag, count]) => {
                const color = tagColor(tag, dataset.tagLibrary);
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm" title={tag}>
                      {tag}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EFECE6]">
                      <div className="h-full rounded-full" style={{ width: `${(count / maxUsage) * 100}%`, background: color }} />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        <DataCard sub="最近 40 条，点击姓名可打开员工档案" title="最近标注动态">
          {dataset.recentAnnotations.length === 0 ? (
            <EmptyHint text="暂无标注记录" />
          ) : (
            <div className="divide-y divide-[var(--lxxl-border)]">
              {dataset.recentAnnotations.map((annotation) => (
                <AnnotationRow
                  key={annotation.id}
                  annotation={annotation}
                  groups={dataset.tagLibrary}
                  onOpenRespondent={onOpenRespondent}
                />
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </div>
  );
}

function AnnotationRow({
  annotation,
  groups,
  onOpenRespondent,
}: {
  annotation: EnterpriseAnnotation;
  groups: EnterpriseTagGroup[];
  onOpenRespondent: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-[8px_minmax(0,1fr)] gap-3 py-3">
      <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--lxxl-green)]" />
      <div className="min-w-0">
        <div className="text-sm">
          <b className="font-semibold">{annotation.operatorName || "工作人员"}</b> 为{" "}
          <button
            className="font-semibold text-[var(--lxxl-green)] hover:underline"
            type="button"
            onClick={() => onOpenRespondent(annotation.respondentKey)}
          >
            {annotation.respondentName || "员工"}
          </button>{" "}
          {annotation.tags.length > 0 ? "更新标签" : "添加记录"}
        </div>
        {annotation.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {annotation.tags.map((tag) => (
              <TagChip key={tag} color={tagColor(tag, groups)} tag={tag} />
            ))}
          </div>
        )}
        {annotation.note && <div className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#5A5A5A]">{annotation.note}</div>}
        <div className="mt-1 text-[11px] text-[var(--lxxl-muted)]">
          {chinaDateTimeText(annotation.createdAt)}
          {annotation.source ? ` · 来源：${annotation.source}` : ""}
        </div>
      </div>
    </div>
  );
}
