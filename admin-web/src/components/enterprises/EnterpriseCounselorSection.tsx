"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { QueryButton, QueryField, QueryResetButton, queryControlClass } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  fetchEnterpriseCounselors,
  saveEnterpriseCounselors,
} from "@/services/assessmentEnterprises";
import type {
  EnterpriseCounselorCandidate,
  EnterpriseCounselorEditor,
  EnterpriseCounselorSaveItem,
} from "@/types/api";

const COPY_FIELDS = [
  { key: "introduce", label: "简介" },
  { key: "qualification", label: "从业资质" },
  { key: "specialty", label: "咨询流派" },
  { key: "field", label: "咨询领域" },
  { key: "trainingExperience", label: "受训背景" },
  { key: "targetGroup", label: "擅长人群" },
] as const;

type CopyKey = (typeof COPY_FIELDS)[number]["key"];

type Draft = {
  accountId: number;
  pinned: boolean;
  sortOrder: number;
} & Record<CopyKey, string>;

function ordered(items: Draft[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.accountId - right.accountId;
  });
}

function resequence(items: Draft[]) {
  return ordered(items).map((item, index) => ({ ...item, sortOrder: index }));
}

function masterText(master: EnterpriseCounselorCandidate | undefined, key: CopyKey) {
  return String(master?.[key] || "");
}

function copyFrom(
  source: Partial<Record<CopyKey, string | null>> | undefined,
  master?: EnterpriseCounselorCandidate,
): Record<CopyKey, string> {
  const copy = {} as Record<CopyKey, string>;
  for (const field of COPY_FIELDS) {
    copy[field.key] = source?.[field.key] ?? masterText(master, field.key);
  }
  return copy;
}

function draftsFromEditor(payload: EnterpriseCounselorEditor): Draft[] {
  const masters = new Map(payload.candidates.map((item) => [item.accountId, item]));
  return resequence(
    payload.selected
      .filter((item) => item.eligible && masters.has(item.accountId))
      .map((item) => {
        const master = masters.get(item.accountId);
        return {
          accountId: item.accountId,
          pinned: item.pinned,
          sortOrder: item.sortOrder,
          ...copyFrom(item, master),
        };
      }),
  );
}

function toSaveItems(items: Draft[]): EnterpriseCounselorSaveItem[] {
  return resequence(items).map((item) => ({
    accountId: item.accountId,
    pinned: item.pinned,
    sortOrder: item.sortOrder,
    ...copyFrom(item),
  }));
}

function avatarSrc(url?: string) {
  const value = (url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function yearsLabel(item: EnterpriseCounselorCandidate) {
  const label = (item.workYearsLabel || "").trim();
  if (label) return label;
  if ((item.workYears || 0) > 0) return `${item.workYears}年`;
  return "—";
}

function specialtyTags(item: EnterpriseCounselorCandidate) {
  const raw = `${item.field || ""} ${item.specialty || ""}`;
  return raw
    .split(/[\s,，、/;|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function EnterpriseCounselorSection({ enterpriseId }: { enterpriseId?: string }) {
  const [candidates, setCandidates] = useState<EnterpriseCounselorCandidate[]>([]);
  const [dropped, setDropped] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedText, setSavedText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copyDraft, setCopyDraft] = useState<Pick<Draft, CopyKey> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const applyPayload = useCallback((payload: EnterpriseCounselorEditor) => {
    setCandidates(payload.candidates || []);
    setDrafts(draftsFromEditor(payload));
    setDropped(
      (payload.selected || [])
        .filter((item) => !item.eligible)
        .map((item) => item.accountId),
    );
  }, []);

  useEffect(() => {
    if (!enterpriseId) {
      setCandidates([]);
      setDrafts([]);
      setDropped([]);
      setReady(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setReady(false);
    setError("");
    fetchEnterpriseCounselors(enterpriseId)
      .then((payload) => {
        if (!cancelled) {
          applyPayload(payload);
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "咨询师名单加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyPayload, enterpriseId]);

  const masters = useMemo(
    () => new Map(candidates.map((item) => [item.accountId, item])),
    [candidates],
  );
  const selectedIds = useMemo(() => new Set(drafts.map((item) => item.accountId)), [drafts]);
  const displayDrafts = ordered(drafts);
  const draftById = useMemo(
    () => new Map(displayDrafts.map((item) => [item.accountId, item])),
    [displayDrafts],
  );
  const visibleRows = useMemo(() => {
    const query = keyword.trim();
    const selectedRows = displayDrafts
      .map((item) => masters.get(item.accountId))
      .filter((item): item is EnterpriseCounselorCandidate => Boolean(item));
    const rest = candidates.filter((item) => !selectedIds.has(item.accountId));
    const rows = [...selectedRows, ...rest];
    if (!query) return rows;
    return rows.filter((item) => item.name.includes(query) || (item.title || "").includes(query));
  }, [candidates, displayDrafts, keyword, masters, selectedIds]);
  const editingCandidate = editingId == null ? undefined : masters.get(editingId);

  const toggle = (accountId: number, checked: boolean) => {
    setSavedText("");
    if (!checked) {
      if (editingId === accountId) closeEditor();
      setDrafts((current) => resequence(current.filter((item) => item.accountId !== accountId)));
      return;
    }
    const master = masters.get(accountId);
    if (!master) return;
    setDrafts((current) => {
      if (current.some((item) => item.accountId === accountId)) return current;
      return resequence([
        ...current,
        {
          accountId,
          pinned: false,
          sortOrder: current.length,
          ...copyFrom(undefined, master),
        },
      ]);
    });
  };

  const pinToTop = (accountId: number) => {
    setSavedText("");
    listRef.current?.scrollTo({ top: 0 });
    setDrafts((current) => {
      const existing = current.find((item) => item.accountId === accountId);
      let next = current;
      if (!existing) {
        const master = masters.get(accountId);
        if (!master) return current;
        next = [
          ...current,
          {
            accountId,
            pinned: false,
            sortOrder: current.length,
            ...copyFrom(undefined, master),
          },
        ];
      }
      const pinned = !existing?.pinned;
      return resequence(
        next.map((item) =>
          item.accountId === accountId
            ? { ...item, pinned, sortOrder: pinned ? -1 : item.sortOrder }
            : item,
        ),
      );
    });
  };

  const closeEditor = () => {
    setEditingId(null);
    setCopyDraft(null);
  };

  const openEditor = (accountId: number) => {
    const draft = drafts.find((item) => item.accountId === accountId);
    if (!draft) return;
    setEditingId(accountId);
    setCopyDraft(copyFrom(draft));
  };

  const commitEditor = () => {
    if (editingId == null || !copyDraft) return;
    setSavedText("");
    setDrafts((current) =>
      current.map((item) => (item.accountId === editingId ? { ...item, ...copyDraft } : item)),
    );
    closeEditor();
  };

  const save = async () => {
    if (!enterpriseId || !ready) return;
    setSaving(true);
    setError("");
    setSavedText("");
    try {
      const payload = await saveEnterpriseCounselors(enterpriseId, toSaveItems(drafts));
      applyPayload(payload);
      setSavedText("已保存。勾选和介绍文案只写在这家企业的配置里。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "咨询师勾选保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-base font-semibold">咨询师勾选</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--lxxl-muted)]">
        先勾选咨询师，行末会出现 🖊。点 🖊 编辑这家企业的介绍页，点向上箭头把这个人排到名单前面。这些改动要点「保存咨询师」之后，才会出现在这家企业的预约咨询区域。
      </p>
      {!enterpriseId ? (
        <p className="mt-4 text-sm text-[var(--lxxl-muted)]">
          请先确认保存这家企业，再进入编辑页勾选咨询师。
        </p>
      ) : loading ? (
        <p className="mt-4 text-sm text-[var(--lxxl-muted)]">正在读取当前环境的咨询师名单...</p>
      ) : !ready ? (
        <p className="mt-4 text-sm text-[#A13F37]">{error || "咨询师名单加载失败"}</p>
      ) : (
        <div className="mt-4 space-y-5">
          <QueryField label="筛选咨询师">
            <input
              className={queryControlClass}
              placeholder="按姓名或头衔筛选"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </QueryField>
          {dropped.length > 0 && (
            <p className="text-sm text-[#A13F37]">
              账号 {dropped.join("、")} 已不在在职且对外可见名单中，这次保存后会从这家企业移除。
            </p>
          )}
          <div ref={listRef} className="max-h-[32rem] divide-y divide-[var(--lxxl-border)] overflow-auto rounded-xl border border-[var(--lxxl-border)]">
            {visibleRows.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[var(--lxxl-muted)]">当前环境没有在职且对外可见的咨询师。</p>
            ) : (
              visibleRows.map((item) => {
                const selected = selectedIds.has(item.accountId);
                const draft = draftById.get(item.accountId);
                return (
                  <div key={item.accountId} className="flex items-center gap-3 px-4 py-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        checked={selected}
                        type="checkbox"
                        onChange={(event) => toggle(item.accountId, event.target.checked)}
                      />
                      <CounselorFace item={item} pinned={Boolean(draft?.pinned)} />
                    </label>
                    <button
                      aria-label={draft?.pinned ? "取消置顶" : "置顶"}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${
                        draft?.pinned
                          ? "border-[var(--lxxl-green)] bg-[var(--lxxl-green)] text-white"
                          : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-ink)] hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
                      }`}
                      title={draft?.pinned ? "取消置顶" : "置顶到最前"}
                      type="button"
                      onClick={() => pinToTop(item.accountId)}
                    >
                      <ArrowUpIcon />
                    </button>
                    {selected && (
                      <button
                        aria-label={`编辑${item.name}的介绍页`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-base leading-none text-[var(--lxxl-muted)] hover:bg-[#F7F5F2] hover:text-[var(--lxxl-ink)]"
                        title="编辑介绍页"
                        type="button"
                        onClick={() => openEditor(item.accountId)}
                      >
                        <span aria-hidden="true">🖊</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {error && <p className="text-sm text-[#A13F37]">{error}</p>}
          {savedText && <p className="text-sm text-[var(--lxxl-green)]">{savedText}</p>}
          <QueryButton className="!w-auto px-4" disabled={saving || !ready} onClick={() => void save()}>
            {saving ? "保存中..." : "保存咨询师"}
          </QueryButton>
        </div>
      )}
      {editingCandidate && copyDraft && (
        <IntroEditorDialog
          copyDraft={copyDraft}
          counselor={editingCandidate}
          onChange={(key, value) => setCopyDraft((current) => (current ? { ...current, [key]: value } : current))}
          onClose={closeEditor}
          onCommit={commitEditor}
        />
      )}
    </div>
  );
}

function IntroEditorDialog({
  counselor,
  copyDraft,
  onChange,
  onClose,
  onCommit,
}: {
  counselor: EnterpriseCounselorCandidate;
  copyDraft: Pick<Draft, CopyKey>;
  onChange: (key: CopyKey, value: string) => void;
  onClose: () => void;
  onCommit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        aria-labelledby="enterprise-counselor-intro-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold" id="enterprise-counselor-intro-title">
          {counselor.name}的介绍页
        </h3>
        <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
          这里改的是这家企业介绍页上的简介、从业资质、咨询流派、咨询领域、受训背景和擅长人群。确定后先留在本页，点「保存咨询师」才会写到这家企业。
        </p>
        <div className="mt-4 space-y-4">
          {COPY_FIELDS.map((field) => {
            const masterValue = masterText(counselor, field.key).trim();
            const overridden = copyDraft[field.key].trim() !== masterValue;
            return (
              <label key={field.key} className="block">
                <span className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--lxxl-muted)]">
                  {field.label}
                  <span className={overridden ? "text-[var(--lxxl-green)]" : ""}>
                    {overridden ? "本企业文案" : "使用主档"}
                  </span>
                </span>
                <textarea
                  className={`${queryControlClass} min-h-28 py-2`}
                  value={copyDraft[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                />
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex gap-3">
          <QueryButton className="!w-auto px-4" onClick={onCommit}>确定</QueryButton>
          <QueryResetButton onClick={onClose}>取消</QueryResetButton>
        </div>
      </div>
    </div>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

function CounselorFace({
  item,
  pinned = false,
}: {
  item: EnterpriseCounselorCandidate;
  pinned?: boolean;
}) {
  const src = avatarSrc(item.avatarUrl);
  const tags = specialtyTags(item);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {src ? (
        <img alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" src={src} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--lxxl-green)] text-sm text-white">
          {item.name.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--lxxl-ink)]">
          {item.name}
          {pinned ? <span className="ml-2 text-xs font-normal text-[var(--lxxl-green)]">已置顶</span> : null}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--lxxl-muted)]">
          {item.title || "心理咨询师"} · 执业 {yearsLabel(item)} · 咨询 {item.consultHours || 0} 小时
          {tags.length ? ` · ${tags.join("、")}` : ""}
        </span>
      </span>
    </div>
  );
}
