"use client";

import { roles } from "@/config/navigation";
import { COUNSELOR_TYPE_OPTIONS, type CounselorType } from "@/config/userRoleMeta";
import { getName } from "@/lib/display";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import { roleLabel } from "@/lib/format";
import type { AdminUser, Role } from "@/types/api";
import { QueryField, queryControlClass } from "@/components/ui";

export function RoleEditModal({
  user,
  manageableRoles,
  selectedRoles,
  counselorType,
  onChange,
  onCounselorTypeChange,
  onClose,
  onSave,
}: {
  user: AdminUser;
  manageableRoles: Role[];
  selectedRoles: Role[];
  counselorType: CounselorType;
  onChange: (roles: Role[]) => void;
  onCounselorTypeChange: (type: CounselorType) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const selectedSet = new Set(selectedRoles);
  const manageableSet = new Set(manageableRoles);
  const counselorSelected = selectedSet.has("Counselor");
  const canManageCounselor = manageableSet.has("Counselor");

  const toggleRole = (role: Role) => {
    if (!manageableSet.has(role) || role === "Patient") {
      return;
    }
    if (selectedSet.has(role)) {
      onChange(selectedRoles.filter((item) => item !== role));
      return;
    }
    onChange([...selectedRoles, role]);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" role="presentation">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl">
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">修改绑定角色</h3>
          <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
            {formatPatientNameWithContractTag(getName(user), user.contractTag)} {user.mobile ? `· ${user.mobile}` : ""}
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {roles.map((role) => {
            const checked = selectedSet.has(role);
            const canChange = manageableSet.has(role) && role !== "Patient";
            if (!checked && !canChange) {
              return null;
            }
            return (
              <label
                key={role}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  checked
                    ? "border-[var(--lxxl-green)] bg-[#F3F8F5]"
                    : "border-[var(--lxxl-border)] bg-white hover:bg-[#FAF8F4]"
                } ${canChange ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <span>
                  <span className="font-medium">{roleLabel(role)}</span>
                  {!canChange && <span className="ml-2 text-xs text-[var(--lxxl-muted)]">不可调整</span>}
                </span>
                <input
                  className="h-4 w-4 accent-[var(--lxxl-green)] disabled:cursor-not-allowed"
                  type="checkbox"
                  checked={checked}
                  disabled={!canChange}
                  onChange={() => toggleRole(role)}
                />
              </label>
            );
          })}
          {selectedRoles.length === 0 && (
            <p className="text-xs text-[#B34B43]">至少需要保留一个绑定角色。</p>
          )}
          {counselorSelected && (
            <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
              <QueryField label="咨询师类型" required>
                <select
                  className={queryControlClass}
                  value={counselorType}
                  disabled={!canManageCounselor}
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
            disabled={selectedRoles.length === 0}
            onClick={onSave}
          >
            保存
          </button>
        </div>
      </section>
    </div>
  );
}
