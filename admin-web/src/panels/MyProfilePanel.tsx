"use client";

import { useEffect, useRef, useState } from "react";

import { PanelHeader, QueryField, queryControlClass } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import { roleLabel } from "@/lib/format";
import type { CurrentUser } from "@/types/api";

const GENDER_OPTIONS = ["男", "女", "其他"] as const;

const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
const AVATAR_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface MyProfileDraft {
  nickname: string;
  realName: string;
  gender: string;
  avatarUrl: string;
  mobile: string;
}

function toDraft(user: CurrentUser): MyProfileDraft {
  return {
    nickname: user.nickname?.trim() || "",
    realName: user.realName?.trim() || "",
    gender: user.gender?.trim() || "",
    avatarUrl: user.avatarUrl?.trim() || "",
    mobile: user.mobile?.trim() || "",
  };
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

function validateAvatarFile(file: File): string | null {
  if (file.size <= 0) {
    return "图片文件不能为空";
  }
  if (file.type && !AVATAR_CONTENT_TYPES.has(file.type.toLowerCase())) {
    return "仅支持 JPG、PNG 或 WebP 图片";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

export function MyProfilePanel({
  currentUser,
  saving,
  onSave,
}: {
  currentUser: CurrentUser;
  saving: boolean;
  onSave: (payload: {
    nickname: string;
    realName: string;
    gender: string;
    avatarFile: File | null;
    avatarUrl: string;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MyProfileDraft>(() => toDraft(currentUser));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarObjectUrlRef = useRef("");

  const isCounselor =
    currentUser.activeRole === "Counselor" || currentUser.roles.includes("Counselor");
  const roleText = roleLabel(
    currentUser.activeRole ||
      currentUser.roles.find(
        (role) => role === "Admin" || role === "Ops" || role === "Assistant" || role === "Counselor",
      ) ||
      currentUser.roles[0],
  );

  useEffect(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
    setDraft(toDraft(currentUser));
    setAvatarFile(null);
    setAvatarObjectUrl("");
    setAvatarError(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }, [currentUser]);

  useEffect(
    () => () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
      }
    },
    [],
  );

  const avatarPreviewUrl = avatarObjectUrl || resolveAvatarPreviewUrl(draft.avatarUrl);
  const displayInitial = (draft.realName || draft.nickname || "我").trim().slice(0, 1) || "我";

  const updateDraft = (field: keyof MyProfileDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      return;
    }
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = nextUrl;
    setAvatarFile(file);
    setAvatarObjectUrl(nextUrl);
    setAvatarError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    await onSave({
      nickname: draft.nickname.trim(),
      realName: draft.realName.trim(),
      gender: draft.gender.trim(),
      avatarFile,
      avatarUrl: draft.avatarUrl,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
        <PanelHeader title="我的资料" description="修改登录后展示的基础信息；手机号不可在此更改。" />
        <form className="space-y-6 px-6 py-6" onSubmit={submit}>
          {isCounselor ? (
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-muted)]">
              此处头像仅用于个人中心展示；对外介绍页头像请在「咨询师管理」中维护。
            </div>
          ) : null}

          <section className="flex flex-col items-center">
            <button
              aria-label="选择头像"
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#FAF8F4] text-3xl font-semibold text-[var(--lxxl-green)] shadow-sm ring-1 ring-[var(--lxxl-border)] transition hover:ring-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="button"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 本地 object URL 无法交给 Next Image 优化。
                <img alt="头像预览" className="h-full w-full object-cover" src={avatarPreviewUrl} />
              ) : (
                <span aria-hidden="true">{displayInitial}</span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={saving}
              type="file"
              onChange={selectAvatar}
            />
            <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
              点击头像更换，支持 JPEG、PNG、WebP，最大 10MB
            </div>
            {avatarError ? (
              <div className="mt-1 text-xs text-[#A13F37]" role="alert">
                {avatarError}
              </div>
            ) : null}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QueryField label="昵称">
              <input
                className={queryControlClass}
                disabled={saving}
                placeholder="请输入昵称"
                value={draft.nickname}
                onChange={(event) => updateDraft("nickname", event.target.value)}
              />
            </QueryField>
            <QueryField label="真实姓名">
              <input
                className={queryControlClass}
                disabled={saving}
                placeholder="请输入真实姓名"
                value={draft.realName}
                onChange={(event) => updateDraft("realName", event.target.value)}
              />
            </QueryField>
            <QueryField label="性别">
              <select
                className={`${queryControlClass} appearance-auto`}
                disabled={saving}
                value={draft.gender}
                onChange={(event) => updateDraft("gender", event.target.value)}
              >
                <option value="">请选择性别</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </QueryField>
            <QueryField label="手机号">
              <input
                className={`${queryControlClass} bg-[#F7F4EF] text-[var(--lxxl-muted)]`}
                disabled
                readOnly
                value={draft.mobile || "未绑定"}
              />
            </QueryField>
            <QueryField label="当前角色">
              <input
                className={`${queryControlClass} bg-[#F7F4EF] text-[var(--lxxl-muted)]`}
                disabled
                readOnly
                value={roleText}
              />
            </QueryField>
          </section>

          <div className="flex justify-end">
            <button
              className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "保存中..." : "保存资料"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
