"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchCounselorDisplayOrder, saveCounselorDisplayOrder } from "@/services/adminCounselors";
import type { CounselorDisplayOrderItem } from "@/types/api";
import { Badge, EmptyState, TableActionButton } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  DEFAULT_COUNSELOR_PUBLIC_AVATAR,
  resolveCounselorAvatarPreviewUrl,
} from "@/lib/counselor-avatar";

function cloneItems(items: CounselorDisplayOrderItem[]) {
  return items.map((item) => ({ ...item }));
}

function sameOrderSignature(a: CounselorDisplayOrderItem[], b: CounselorDisplayOrderItem[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.counselorId === other.counselorId &&
      item.isPinned === other.isPinned &&
      item.isPublicVisible === other.isPublicVisible
    );
  });
}

export function CounselorDisplayOrderSection({
  enabled,
  onNotice,
}: {
  enabled: boolean;
  onNotice: (tone: "success" | "error", message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CounselorDisplayOrderItem[]>([]);
  const [baseline, setBaseline] = useState<CounselorDisplayOrderItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const dirty = useMemo(() => !sameOrderSignature(items, baseline), [baseline, items]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchCounselorDisplayOrder();
      const next = cloneItems(result.items || []);
      setItems(next);
      setBaseline(cloneItems(next));
      setLoaded(true);
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "展示排序加载失败");
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    if (!enabled || !open || loaded || loading) return;
    void load();
  }, [enabled, loaded, loading, load, open]);

  if (!enabled) {
    return null;
  }

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = cloneItems(prev);
      const tmp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = tmp;
      return next;
    });
  };

  const togglePin = (index: number) => {
    setItems((prev) => {
      const next = cloneItems(prev);
      const target = next[index];
      const pinned = !target.isPinned;
      target.isPinned = pinned;
      if (pinned) {
        next.splice(index, 1);
        next.unshift(target);
      }
      return next;
    });
  };

  const toggleHidden = (index: number) => {
    setItems((prev) => {
      const next = cloneItems(prev);
      next[index] = {
        ...next[index],
        isPublicVisible: !next[index].isPublicVisible,
      };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveCounselorDisplayOrder({
        items: items.map((item, index) => ({
          counselorId: item.counselorId,
          isPinned: item.isPinned,
          isPublicVisible: item.isPublicVisible,
          listSortRank: index + 1,
        })),
      });
      const next = cloneItems(result.items || []);
      setItems(next);
      setBaseline(cloneItems(next));
      onNotice("success", "咨询师展示排序已保存，小程序端刷新后生效");
    } catch (error) {
      onNotice("error", error instanceof Error ? error.message : "保存展示排序失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(cloneItems(baseline));
  };

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition hover:text-[var(--lxxl-green)] sm:px-7 lg:px-8"
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen && !loaded) {
            void load();
          }
        }}
      >
        <span className="min-w-0">
          <span className="text-xl font-semibold tracking-normal">调整咨询师排序</span>
          {loaded ? (
            <span className="ml-2 text-xs font-normal text-[var(--lxxl-muted)]">{items.length} 人</span>
          ) : null}
          <span className="mt-2 block text-sm leading-6 text-[var(--lxxl-muted)]">
            控制小程序首页与心理咨询列表对来访的展示顺序、置顶与隐藏
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
          <p className="text-sm leading-6 text-[var(--lxxl-muted)]">
            顺序与来访端一致。可置顶、上移；隐藏后不会出现在来访端列表与搜索，但仍可在本页与角色绑定中看到。修改后需点「保存排序」才会生效。
          </p>

          {loading && items.length === 0 ? (
            <EmptyState text="正在加载展示排序..." />
          ) : items.length === 0 ? (
            <EmptyState text="暂无启用中的咨询师可调整。" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--lxxl-border)]">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="w-[8%] px-4 py-3 font-medium">序号</th>
                    <th className="w-[34%] px-4 py-3 font-medium">咨询师</th>
                    <th className="w-[14%] px-4 py-3 font-medium">标价</th>
                    <th className="w-[14%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[30%] px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.counselorId} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-4 py-3 text-[var(--lxxl-muted)]">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full bg-[#E8EFEA] object-cover"
                            src={resolveCounselorAvatarPreviewUrl(item.avatarUrl, API_BASE_URL)}
                            onError={(event) => {
                              const target = event.currentTarget;
                              const fallback = resolveCounselorAvatarPreviewUrl(
                                DEFAULT_COUNSELOR_PUBLIC_AVATAR,
                                API_BASE_URL,
                              );
                              if (target.src !== fallback) {
                                target.src = fallback;
                              }
                            }}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--lxxl-text)]">{item.name}</div>
                            <div className="truncate text-xs text-[var(--lxxl-muted)]">
                              {item.title || "未填写职称"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">¥{item.billingYuan}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {item.isPinned ? <Badge tone="green">置顶</Badge> : null}
                          {!item.isPublicVisible ? <Badge tone="neutral">已隐藏</Badge> : null}
                          {item.isPublicVisible && !item.isPinned ? (
                            <span className="text-xs text-[var(--lxxl-muted)]">展示中</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <TableActionButton onClick={() => togglePin(index)}>
                            {item.isPinned ? "取消置顶" : "置顶"}
                          </TableActionButton>
                          <TableActionButton disabled={index === 0} title="上移" onClick={() => moveUp(index)}>
                            ↑
                          </TableActionButton>
                          <TableActionButton
                            tone={item.isPublicVisible ? "muted" : "danger"}
                            onClick={() => toggleHidden(index)}
                          >
                            {item.isPublicVisible ? "隐藏" : "已隐藏"}
                          </TableActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="h-10 shrink-0 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!dirty || saving || items.length === 0}
              type="button"
              onClick={() => void handleSave()}
            >
              {saving ? "保存中..." : "保存排序"}
            </button>
            <TableActionButton disabled={!dirty || saving} tone="muted" onClick={handleReset}>
              撤销未保存修改
            </TableActionButton>
            <TableActionButton disabled={loading || saving} tone="muted" onClick={() => void load()}>
              重新加载
            </TableActionButton>
            {dirty ? (
              <span className="text-xs text-[#A13F37]">有未保存的调整</span>
            ) : (
              <span className="text-xs text-[var(--lxxl-muted)]">当前与已生效顺序一致</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
