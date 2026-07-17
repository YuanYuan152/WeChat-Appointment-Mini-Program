import { useEffect, useMemo, useState } from "react";

import { QueryButton, QueryResetButton, TableActionButton } from "@/components/ui";

const STAFF_REMARK_MAX_LENGTH = 2000;

export function StaffRemarkEditor({
  accountId,
  value,
  saving,
  onSave,
}: {
  accountId: number;
  value?: string | null;
  saving: boolean;
  onSave: (remark: string) => Promise<string>;
}) {
  const savedValue = useMemo(() => (value || "").trim(), [value]);
  const [draft, setDraft] = useState(savedValue);
  const normalizedDraft = draft.trim();
  const dirty = normalizedDraft !== savedValue;

  useEffect(() => {
    setDraft(savedValue);
  }, [accountId, savedValue]);

  const save = async () => {
    if (!dirty || saving) {
      return;
    }
    try {
      const saved = await onSave(normalizedDraft);
      setDraft(saved);
    } catch {
      // 页面级通知会展示后端返回的业务错误，保留草稿供工作人员修改后重试。
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">内部备注</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
            仅咨询助理、咨询主任和管理员可见，不会展示给来访或咨询师。
          </p>
        </div>
        <span className="text-xs text-[var(--lxxl-muted)]">
          {draft.length}/{STAFF_REMARK_MAX_LENGTH}
        </span>
      </div>
      <textarea
        className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[var(--lxxl-border)] bg-white px-3 py-2 text-sm leading-6 text-[var(--lxxl-text)] outline-none transition placeholder:text-[var(--lxxl-muted)] focus:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={saving}
        maxLength={STAFF_REMARK_MAX_LENGTH}
        placeholder="填写内部备注，保存后在来访管理或咨询师管理中展示"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <QueryButton disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "保存中" : "保存备注"}
        </QueryButton>
        <QueryResetButton
          disabled={saving || draft.length === 0}
          onClick={() => setDraft("")}
        >
          清空
        </QueryResetButton>
        {dirty && (
          <TableActionButton disabled={saving} tone="muted" onClick={() => setDraft(savedValue)}>
            放弃修改
          </TableActionButton>
        )}
      </div>
    </section>
  );
}
