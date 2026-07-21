"use client";

import {
  COUNSELOR_TYPE_OPTIONS,
  type CounselorType,
  PATIENT_SOURCE_OPTIONS,
  type PatientSource,
} from "@/config/userRoleMeta";
import { getName } from "@/lib/display";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import { roleLabel } from "@/lib/format";
import type { AdminUser, Role } from "@/types/api";
import { QueryField, queryControlClass } from "@/components/ui";

export function RoleEditModal({
  user,
  roleOptions,
  selectedRole,
  patientSource,
  counselorType,
  onRoleChange,
  onPatientSourceChange,
  onCounselorTypeChange,
  onClose,
  onSave,
}: {
  user: AdminUser;
  roleOptions: Array<{ value: Role; label: string }>;
  selectedRole: Role | null;
  patientSource: PatientSource;
  counselorType: CounselorType;
  onRoleChange: (role: Role) => void;
  onPatientSourceChange: (source: PatientSource) => void;
  onCounselorTypeChange: (type: CounselorType) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const patientSelected = selectedRole === "Patient";
  const counselorSelected = selectedRole === "Counselor";
  const canSave = !!selectedRole && roleOptions.some((option) => option.value === selectedRole);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" role="presentation">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl">
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">更换角色</h3>
          <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
            {formatPatientNameWithContractTag(getName(user), user.contractTag)} {user.mobile ? `· ${user.mobile}` : ""}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
            每个账号仅保留一个角色。更换后用户需重新登录后生效。
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {roleOptions.length === 0 ? (
            <p className="text-sm text-[var(--lxxl-muted)]">当前账号无可赋权角色。</p>
          ) : (
            roleOptions.map((option) => {
              const checked = selectedRole === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    checked
                      ? "border-[var(--lxxl-green)] bg-[#F3F8F5]"
                      : "border-[var(--lxxl-border)] bg-white hover:bg-[#FAF8F4]"
                  }`}
                >
                  <span className="font-medium">{option.label || roleLabel(option.value)}</span>
                  <input
                    className="h-4 w-4 accent-[var(--lxxl-green)]"
                    type="radio"
                    name="admin-role"
                    checked={checked}
                    onChange={() => onRoleChange(option.value)}
                  />
                </label>
              );
            })
          )}
          {patientSelected && (
            <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
              <QueryField label="来访来源" required>
                <select
                  className={queryControlClass}
                  value={patientSource}
                  onChange={(event) => onPatientSourceChange(event.target.value as PatientSource)}
                >
                  {PATIENT_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </QueryField>
            </div>
          )}
          {counselorSelected && (
            <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
              <QueryField label="咨询师类型" required>
                <select
                  className={queryControlClass}
                  value={counselorType}
                  onChange={(event) => onCounselorTypeChange(event.target.value as CounselorType)}
                >
                  {COUNSELOR_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-[var(--lxxl-muted)]">
                  保存后会同步咨询师档案中的专业/公益类型。
                </span>
              </QueryField>
            </div>
          )}
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
            type="button"
            disabled={!canSave}
            onClick={onSave}
          >
            保存
          </button>
        </div>
      </section>
    </div>
  );
}
