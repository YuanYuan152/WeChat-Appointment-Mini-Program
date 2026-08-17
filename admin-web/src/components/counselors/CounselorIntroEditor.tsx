"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { QueryField, queryControlClass } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import { getCounselorAvatarFileError } from "@/lib/counselor-avatar";
import { uploadImage } from "@/services/uploads";
import type { AdminCounselorIntroProfile, AdminCounselorIntroUpdatePayload } from "@/types/api";

const GENDER_OPTIONS = ["男", "女"];
const MODE_OPTIONS = ["视频咨询", "面询", "视频咨询/面询"];

type CounselorIntroDraft = {
  name: string;
  avatarUrl: string;
  title: string;
  workYears: string;
  consultHours: string;
  trainingExperience: string;
  gender: string;
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

function normalizeModeLabel(mode?: string | null) {
  const raw = (mode || "").trim();
  if (!raw) return "视频咨询/面询";
  if (MODE_OPTIONS.includes(raw)) return raw;
  const hasOnline = /线上|在线|视频|video|online/i.test(raw);
  const hasOffline = /线下|面询|面对面|offline/i.test(raw);
  if (hasOnline && hasOffline) return "视频咨询/面询";
  if (hasOnline) return "视频咨询";
  if (hasOffline) return "面询";
  return "视频咨询/面询";
}

function toDraft(profile: AdminCounselorIntroProfile): CounselorIntroDraft {
  return {
    name: asText(profile.name),
    avatarUrl: asText(profile.avatarUrl),
    title: asText(profile.title),
    workYears: asText(profile.workYears),
    consultHours: asText(profile.consultHours),
    trainingExperience: asText(profile.trainingExperience),
    gender: profile.gender === "男" || profile.gender === "女" ? profile.gender : "",
    mode: normalizeModeLabel(profile.mode),
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

function resolveAvatarPreviewUrl(value?: string | null) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "";
  }
  try {
    const resolvedUrl = new URL(trimmedValue, `${API_BASE_URL}/`);
    return ["http:", "https:", "blob:", "data:"].includes(resolvedUrl.protocol)
      ? resolvedUrl.toString()
      : "";
  } catch {
    return "";
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarObjectUrlRef = useRef("");
  const submittingRef = useRef(false);

  useEffect(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
    setDraft(toDraft(profile));
    setErrors({});
    setAvatarFile(null);
    setAvatarObjectUrl("");
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }, [profile]);

  useEffect(
    () => () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    },
    [],
  );

  const busy = saving || submitting;
  const avatarPreviewUrl =
    avatarObjectUrl || resolveAvatarPreviewUrl(draft.avatarUrl);

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

  const releaseAvatarObjectUrl = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
    setAvatarObjectUrl("");
  };

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    releaseAvatarObjectUrl();
    setAvatarFile(null);
    const validationError = getCounselorAvatarFileError(file);
    if (validationError) {
      setErrors((prev) => ({ ...prev, avatarUrl: validationError }));
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;
    setAvatarObjectUrl(objectUrl);
    setAvatarFile(file);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.avatarUrl;
      return next;
    });
  };

  const cancel = () => {
    if (busy) {
      return;
    }
    releaseAvatarObjectUrl();
    setAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
    onCancel();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || saving) {
      return;
    }
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

    submittingRef.current = true;
    setSubmitting(true);
    try {
      let avatarUrl = nullableText(draft.avatarUrl);
      if (avatarFile) {
        try {
          const uploadResult = await uploadImage(avatarFile);
          avatarUrl = nullableText(uploadResult.url || "");
          if (!avatarUrl) {
            throw new Error("上传接口未返回头像地址");
          }
        } catch (error) {
          setErrors((prev) => ({
            ...prev,
            avatarUrl: errorMessage(error, "头像上传失败，请重试"),
          }));
          return;
        }
      }

      await onSave({
        name: draft.name.trim(),
        avatarUrl,
        title: nullableText(draft.title),
        workYears,
        consultHours,
        trainingExperience: nullableText(draft.trainingExperience),
        gender: draft.gender.trim() || "",
        mode: nullableText(draft.mode),
        field: nullableText(draft.field),
        targetGroup: nullableText(draft.targetGroup),
        specialty: nullableText(draft.specialty),
        introduce: nullableText(draft.introduce),
        qualification: nullableText(draft.qualification),
        isActive: profile.isActive,
      });
      releaseAvatarObjectUrl();
      onCancel();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <section className="flex flex-col items-center">
        <button
          aria-label="选择咨询师头像"
          className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#FAF8F4] text-3xl font-semibold text-[var(--lxxl-green)] shadow-sm ring-1 ring-[var(--lxxl-border)] transition hover:ring-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => avatarInputRef.current?.click()}
        >
          {avatarPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 本地 object URL 无法交给 Next Image 优化。
            <img
              alt={`${draft.name || "咨询师"}头像`}
              className="h-full w-full object-cover"
              src={avatarPreviewUrl}
            />
          ) : (
            <span aria-hidden="true">{draft.name.trim().slice(0, 1) || "头像"}</span>
          )}
        </button>
        <input
          ref={avatarInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={busy}
          type="file"
          onChange={selectAvatar}
        />
        <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
          点击头像更换，支持 JPEG、PNG、WebP，最大 10MB
        </div>
        {errors.avatarUrl ? (
          <div className="mt-1 text-xs text-[#A13F37]" role="alert">
            {errors.avatarUrl}
          </div>
        ) : null}
      </section>

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
          <QueryField label="性别">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={draft.gender}
              onChange={(event) => updateDraft("gender", event.target.value)}
            >
              <option value="">未设置</option>
              {GENDER_OPTIONS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
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
          <QueryField className="sm:col-span-2" label="培训经历">
            <textarea
              className={`${queryControlClass} h-32 resize-y py-3`}
              placeholder="每段经历建议单独一行"
              value={draft.trainingExperience}
              onChange={(event) => updateDraft("trainingExperience", event.target.value)}
            />
            {!draft.trainingExperience && profile.career ? (
              <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
                旧字段只读回退：{profile.career}
              </div>
            ) : null}
          </QueryField>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
        <button
          className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? (avatarFile ? "上传并保存中..." : "保存中...") : "保存"}
        </button>
        <button
          className="h-10 rounded-xl border border-[var(--lxxl-border)] px-5 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
          disabled={busy}
          type="button"
          onClick={cancel}
        >
          取消
        </button>
      </div>
    </form>
  );
}
