"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { QueryField, queryControlClass } from "@/components/ui";
import type { AdminCounselorIntroProfile, AdminCounselorIntroUpdatePayload } from "@/types/api";

const MODE_OPTIONS = ["线上", "线下", "线上/线下"];

type CounselorIntroDraft = {
  name: string;
  avatarUrl: string;
  title: string;
  workYears: string;
  consultHours: string;
  career: string;
  mode: string;
  field: string;
  targetGroup: string;
  specialty: string;
  introduce: string;
  qualification: string;
};

type CounselorIntroErrors = Partial<Record<keyof CounselorIntroDraft, string>>;

function asText(value?: string | number | null) {
  return value == null ? "" : String(value);
}

function toDraft(profile: AdminCounselorIntroProfile): CounselorIntroDraft {
  return {
    name: asText(profile.name),
    avatarUrl: asText(profile.avatarUrl),
    title: asText(profile.title),
    workYears: asText(profile.workYears),
    consultHours: asText(profile.consultHours),
    career: asText(profile.career),
    mode: profile.mode || "线上/线下",
    field: asText(profile.field),
    targetGroup: asText(profile.targetGroup),
    specialty: asText(profile.specialty),
    introduce: asText(profile.introduce),
    qualification: asText(profile.qualification),
  };
}

function nullableText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function nonNegativeNumber(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 0;
  }
  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? Math.max(0, Math.trunc(parsedValue)) : Number.NaN;
}

export function CounselorIntroEditor({
  profile,
  saving,
  onCancel,
  onSave,
}: {
  profile: AdminCounselorIntroProfile;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: AdminCounselorIntroUpdatePayload) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CounselorIntroDraft>(() => toDraft(profile));
  const [errors, setErrors] = useState<CounselorIntroErrors>({});

  useEffect(() => {
    setDraft(toDraft(profile));
    setErrors({});
  }, [profile]);

  const authenticityText = useMemo(() => {
    if (!profile.infoAuthenticityCommitted) {
      return "未签署真实性承诺";
    }
    const signer = profile.infoAuthenticitySignerName ? `签署人：${profile.infoAuthenticitySignerName}` : "已签署";
    const time = profile.infoAuthenticityCommittedAt ? `，时间：${profile.infoAuthenticityCommittedAt.slice(0, 16).replace("T", " ")}` : "";
    return `${signer}${time}`;
  }, [profile.infoAuthenticityCommitted, profile.infoAuthenticityCommittedAt, profile.infoAuthenticitySignerName]);

  const updateDraft = (field: keyof CounselorIntroDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: CounselorIntroErrors = {};
    const workYears = nonNegativeNumber(draft.workYears);
    const consultHours = nonNegativeNumber(draft.consultHours);

    if (!draft.name.trim()) {
      nextErrors.name = "请填写咨询师姓名";
    }
    if (Number.isNaN(workYears)) {
      nextErrors.workYears = "从业年限需为数字";
    }
    if (Number.isNaN(consultHours)) {
      nextErrors.consultHours = "咨询时数需为数字";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSave({
      name: draft.name.trim(),
      avatarUrl: nullableText(draft.avatarUrl),
      title: nullableText(draft.title),
      workYears,
      consultHours,
      career: nullableText(draft.career),
      mode: nullableText(draft.mode),
      field: nullableText(draft.field),
      targetGroup: nullableText(draft.targetGroup),
      specialty: nullableText(draft.specialty),
      introduce: nullableText(draft.introduce),
      qualification: nullableText(draft.qualification),
      isActive: profile.isActive,
    });
    onCancel();
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <section className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">
        <div className="font-medium text-[var(--lxxl-text)]">当前介绍页</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>咨询师：{profile.name || "-"}</div>
          <div>状态：{profile.isActive ? "启用" : "停用"}</div>
          <div>真实性承诺：{authenticityText}</div>
          <div>默认收费：¥{profile.billingYuan ?? "-"} / 面询 ¥{profile.faceBillingYuan ?? "-"}</div>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold">基础资料</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QueryField error={errors.name} label="姓名" required>
            <input
              className={queryControlClass}
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
            />
          </QueryField>
          <QueryField label="头像 URL">
            <input
              className={queryControlClass}
              placeholder="https://..."
              value={draft.avatarUrl}
              onChange={(event) => updateDraft("avatarUrl", event.target.value)}
            />
          </QueryField>
          <QueryField label="职称/头衔">
            <input
              className={queryControlClass}
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
            />
          </QueryField>
          <QueryField error={errors.workYears} label="从业年限">
            <input
              className={queryControlClass}
              inputMode="numeric"
              value={draft.workYears}
              onChange={(event) => updateDraft("workYears", event.target.value)}
            />
          </QueryField>
          <QueryField error={errors.consultHours} label="咨询时数">
            <input
              className={queryControlClass}
              inputMode="numeric"
              value={draft.consultHours}
              onChange={(event) => updateDraft("consultHours", event.target.value)}
            />
          </QueryField>
          <QueryField label="培训经历（段数）">
            <input
              className={queryControlClass}
              placeholder="如 4"
              value={draft.career}
              onChange={(event) => updateDraft("career", event.target.value)}
            />
          </QueryField>
          <QueryField label="咨询方式">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={draft.mode}
              onChange={(event) => updateDraft("mode", event.target.value)}
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </QueryField>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold">介绍页内容</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QueryField label="专业领域">
            <input
              className={queryControlClass}
              placeholder="逗号分隔"
              value={draft.field}
              onChange={(event) => updateDraft("field", event.target.value)}
            />
          </QueryField>
          <QueryField label="服务人群">
            <input
              className={queryControlClass}
              placeholder="逗号分隔"
              value={draft.targetGroup}
              onChange={(event) => updateDraft("targetGroup", event.target.value)}
            />
          </QueryField>
          <QueryField className="sm:col-span-2" label="擅长方向">
            <textarea
              className={`${queryControlClass} h-28 resize-y py-3`}
              value={draft.specialty}
              onChange={(event) => updateDraft("specialty", event.target.value)}
            />
          </QueryField>
          <QueryField className="sm:col-span-2" label="简介">
            <textarea
              className={`${queryControlClass} h-32 resize-y py-3`}
              value={draft.introduce}
              onChange={(event) => updateDraft("introduce", event.target.value)}
            />
          </QueryField>
          <QueryField className="sm:col-span-2" label="资质证书">
            <textarea
              className={`${queryControlClass} h-28 resize-y py-3`}
              value={draft.qualification}
              onChange={(event) => updateDraft("qualification", event.target.value)}
            />
          </QueryField>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
        <button
          className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          className="h-10 rounded-xl border border-[var(--lxxl-border)] px-5 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
          disabled={saving}
          type="button"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </form>
  );
}
