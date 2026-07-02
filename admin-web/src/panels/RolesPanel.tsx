import { type FormEvent, useMemo, useState } from "react";

import { roleLabel } from "@/lib/format";
import type { AdminUser, Role } from "@/types/api";

import { getName } from "@/lib/display";
import { getPageItems } from "@/lib/pagination";
import { RoleEditModal } from "@/components/roles/RoleEditModal";
import {
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

export function RolesPanel({
  users,
  listLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onUpdateRoles,
}: {
  users?: AdminUser[];
  listLoading?: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onUpdateRoles: (userId: number, currentRoles: Role[], nextRoles: Role[]) => void;
}) {
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const allUsers = useMemo(() => users || [], [users]);
  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return allUsers;
    }
    return allUsers.filter((user) => {
      const name = getName(user).toLowerCase();
      const mobile = user.mobile?.toLowerCase() || "";
      return name.includes(normalizedKeyword) || mobile.includes(normalizedKeyword);
    });
  }, [allUsers, keyword]);
  const { currentPage, items } = getPageItems(filteredUsers, page, pageSize);

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(keywordInput.trim());
    onPageChange(1);
  };

  const resetQuery = () => {
    setKeywordInput("");
    setKeyword("");
    onPageChange(1);
  };

  const openEditor = (user: AdminUser) => {
    setEditingUser(user);
    setSelectedRoles(user.roles);
  };

  const closeEditor = () => {
    setEditingUser(null);
    setSelectedRoles([]);
  };

  const saveRoles = () => {
    if (!editingUser || selectedRoles.length === 0) {
      return;
    }
    onUpdateRoles(editingUser.id, editingUser.roles, selectedRoles);
    closeEditor();
  };

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form className="px-6 py-5 sm:px-7 lg:px-8" onSubmit={submitQuery}>
        <div>
          <h2 className="text-xl font-semibold tracking-normal">用户与角色</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            复用 `/api/mini/admin/users*`，只允许 Admin 操作。
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="姓名/电话">
            <input
              className={queryControlClass}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="请输入姓名或电话"
            />
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={resetQuery} />
        </div>
      </form>
      <div className="relative">
        {listLoading && users && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!users ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无数据或当前账号没有管理员权限。"} />
        ) : (
          <>
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
              {items.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-[var(--lxxl-muted)]" colSpan={5}>
                    暂无匹配用户。
                  </td>
                </tr>
              ) : (
                items.map((user) => (
                <tr key={user.id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="px-5 py-4">{getName(user)}</td>
                  <td className="px-5 py-4">{user.mobile || "-"}</td>
                  <td className="px-5 py-4">{roleLabel(user.activeRole)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span key={role} className="rounded-full bg-[#F4F1EB] px-3 py-1 text-xs">
                            {roleLabel(role)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--lxxl-muted)]">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <TableActionButton onClick={() => openEditor(user)}>
                      修改
                    </TableActionButton>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filteredUsers.length}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
          </>
        )}
      </div>
      {editingUser && (
        <RoleEditModal
          user={editingUser}
          selectedRoles={selectedRoles}
          onChange={setSelectedRoles}
          onClose={closeEditor}
          onSave={saveRoles}
        />
      )}
    </section>
  );
}
