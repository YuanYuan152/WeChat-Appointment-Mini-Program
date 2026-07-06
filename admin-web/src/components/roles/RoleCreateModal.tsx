"use client";

import { type FormEvent, useMemo, useState } from "react";

import {
  COUNSELOR_TYPE_OPTIONS,
  type CounselorType,
  PATIENT_SOURCE_OPTIONS,
  type PatientSource,
} from "@/config/userRoleMeta";
import { roleLabel } from "@/lib/format";
import type { CreateUserByMobilePayload } from "@/services/roles";
import type { Role } from "@/types/api";
import { QueryField, queryControlClass } from "@/components/ui";

const DEFAULT_ROLE: Role = "Counselor";

export function RoleCreateModal({
  roleOptions,
  submitting,
  onClose,
  onCreate,
}: {
  roleOptions: Array<{ value: Role; label: string }>;
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateUserByMobilePayload) => Promise<void>;
}) {
  const [mobile, setMobile] = useState("");
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<Role>(() => roleOptions[0]?.value || DEFAULT_ROLE);
  const [patientSource, setPatientSource] = useState<PatientSource>("MINI_PROGRAM");
  const [counselorType, setCounselorType] = useState<CounselorType>("PROFESSIONAL");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  const roleHelperText = useMemo(() => {
    if (role === "Patient") {
      return "来访者会自动保留基础来访角色，并记录来访来源。";
    }
    if (role === "Counselor") {
      return "咨询师会同步创建或恢复咨询师档案。";
    }
    if (role === "Ops") {
      return "运营可进入管理工作台。";
    }
    if (role === "Assistant") {
      return "咨询助理可进入管理工作台。";
    }
    return "管理员可进入权限管理和全部后台功能。";
  }, [role]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedMobile = mobile.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(normalizedMobile)) {
      nextErrors.mobile = "请输入有效的11位手机号";
    }
    if (!roleOptions.some((option) => option.value === role)) {
      nextErrors.role = "请选择当前账号可创建的角色";
    }
    if (role === "Patient" && !patientSource) {
      nextErrors.patientSource = "请选择来访来源";
    }
    if (role === "Counselor" && !counselorType) {
      nextErrors.counselorType = "请选择咨询师类型";
    }
    setErrors(nextErrors);
    return {
      ok: Object.keys(nextErrors).length === 0,
      normalizedMobile,
    };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    const result = validate();
    if (!result.ok) {
      return;
    }

    const payload: CreateUserByMobilePayload = {
      mobile: result.normalizedMobile,
      role,
    };
    const normalizedName = nickname.trim();
    if (normalizedName) {
      payload.nickname = normalizedName;
    }
    if (role === "Patient") {
      payload.patient_source = patientSource;
    }
    if (role === "Counselor") {
      payload.counselor_type = counselorType;
    }

    try {
      await onCreate(payload);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "创建失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 py-6" role="presentation">
      <section
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="新建用户角色"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">新建用户角色</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            填写手机号即可为对方注册后台账号；手机号已存在时，会在原账号上补充所选角色。
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <QueryField label="手机号" required error={errors.mobile}>
              <input
                className={queryControlClass}
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="请输入11位手机号"
                inputMode="numeric"
                maxLength={20}
              />
            </QueryField>
            <QueryField label="姓名/昵称">
              <input
                className={queryControlClass}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="不填则自动生成"
                maxLength={50}
              />
            </QueryField>
            <QueryField label="角色" required error={errors.role}>
              <select
                className={queryControlClass}
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as Role);
                  setErrors((prev) => ({ ...prev, role: "" }));
                }}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-[var(--lxxl-muted)]">{roleHelperText}</span>
            </QueryField>
            {role === "Patient" && (
              <QueryField label="来访来源" required error={errors.patientSource}>
                <select
                  className={queryControlClass}
                  value={patientSource}
                  onChange={(event) => setPatientSource(event.target.value as PatientSource)}
                >
                  {PATIENT_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </QueryField>
            )}
            {role === "Counselor" && (
              <QueryField label="咨询师类型" required error={errors.counselorType}>
                <select
                  className={queryControlClass}
                  value={counselorType}
                  onChange={(event) => setCounselorType(event.target.value as CounselorType)}
                >
                  {COUNSELOR_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </QueryField>
            )}
            {submitError && (
              <div className="rounded-xl border border-[#F2B8B0] bg-[#FFF4F2] px-4 py-3 text-sm text-[#A13F37] sm:col-span-2">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
            <button
              className="h-10 rounded-xl border border-[var(--lxxl-border)] px-5 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
              type="button"
              disabled={submitting}
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-45"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "创建中..." : `创建${roleLabel(role)}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
