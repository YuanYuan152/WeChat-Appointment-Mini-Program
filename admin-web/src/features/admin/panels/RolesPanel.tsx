import type { Dispatch, SetStateAction } from "react";

import { roleLabel } from "@/lib/format";
import type { AdminUser, Role } from "@/types/api";

import { roles } from "../constants";
import { getName } from "../utils";
import { EmptyState, PanelHeader } from "../components/ui";

export function RolesPanel({
  users,
  roleDrafts,
  setRoleDrafts,
  onBindRole,
  onUnbindRole,
}: {
  users?: AdminUser[];
  roleDrafts: Record<number, Role>;
  setRoleDrafts: Dispatch<SetStateAction<Record<number, Role>>>;
  onBindRole: (userId: number, role: Role) => void;
  onUnbindRole: (userId: number, role: Role) => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="用户与角色" description="复用 `/api/mini/admin/users*`，只允许 Admin 操作。" />
      {!users ? (
        <EmptyState text="暂无数据或当前账号没有管理员权限。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">用户</th>
              <th className="px-5 py-3 font-medium">手机</th>
              <th className="px-5 py-3 font-medium">当前角色</th>
              <th className="px-5 py-3 font-medium">绑定角色</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--lxxl-border)] align-top">
                <td className="px-5 py-4">{getName(user)}</td>
                <td className="px-5 py-4">{user.mobile || "-"}</td>
                <td className="px-5 py-4">{roleLabel(user.activeRole)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <button
                        key={role}
                        className="rounded-full bg-[#F4F1EB] px-3 py-1 text-xs"
                        type="button"
                        onClick={() => onUnbindRole(user.id, role)}
                      >
                        {roleLabel(role)} ×
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
                      value={roleDrafts[user.id] || "Ops"}
                      onChange={(event) =>
                        setRoleDrafts((prev) => ({
                          ...prev,
                          [user.id]: event.target.value as Role,
                        }))
                      }
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-xl bg-[var(--lxxl-green)] px-4 py-2 text-sm font-medium text-white"
                      type="button"
                      onClick={() => onBindRole(user.id, roleDrafts[user.id] || "Ops")}
                    >
                      绑定
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
