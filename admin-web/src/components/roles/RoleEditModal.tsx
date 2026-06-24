"use client";

import { roles } from "@/config/navigation";
import { getName } from "@/lib/display";
import { roleLabel } from "@/lib/format";
import type { AdminUser, Role } from "@/types/api";

export function RoleEditModal({
  user,
  selectedRoles,
  onChange,
  onClose,
  onSave,
}: {
  user: AdminUser;
  selectedRoles: Role[];
  onChange: (roles: Role[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const selectedSet = new Set(selectedRoles);

  const toggleRole = (role: Role) => {
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
            {getName(user)} {user.mobile ? `· ${user.mobile}` : ""}
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {roles.map((role) => {
            const checked = selectedSet.has(role);
            return (
              <label
                key={role}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  checked
                    ? "border-[var(--lxxl-green)] bg-[#F3F8F5]"
                    : "border-[var(--lxxl-border)] bg-white hover:bg-[#FAF8F4]"
                }`}
              >
                <span className="font-medium">{roleLabel(role)}</span>
                <input
                  className="h-4 w-4 accent-[var(--lxxl-green)]"
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(role)}
                />
              </label>
            );
          })}
          {selectedRoles.length === 0 && (
            <p className="text-xs text-[#B34B43]">至少需要保留一个绑定角色。</p>
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
