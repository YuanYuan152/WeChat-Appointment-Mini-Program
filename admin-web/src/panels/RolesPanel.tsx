import { type FormEvent, useMemo, useState } from "react";

import {
  canActorManageUser,
  COUNSELOR_TYPE_OPTIONS,
  type CounselorType,
  getManageableRoles,
  isKeyLoginAdminOpenId,
  PATIENT_SOURCE_OPTIONS,
  type PatientSource,
  resolveHighestStaffRole,
} from "@/config/userRoleMeta";
import {
  subtypeSelectOptionsForRoleGroup,
  type RoleGroupValue,
} from "@/config/roleGroupFilter";
import { roleLabel } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { AdminUser, Role } from "@/types/api";

import { getName } from "@/lib/display";
import { getPageItems } from "@/lib/pagination";
import type { BindUserRolePayload, CreateUserByMobilePayload, FetchAdminUsersParams } from "@/services/roles";
import { RoleCreateModal } from "@/components/roles/RoleCreateModal";
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
  currentUserId,
  currentUserRoles,
  currentUserOpenId,
  listLoading,
  page,
  pageSize,
  createLoading,
  onPageChange,
  onPageSizeChange,
  onCreateUser,
  onUpdateRole,
  onDeleteUser,
  onQuery,
}: {
  users?: AdminUser[];
  currentUserId: number;
  currentUserRoles: Role[];
  currentUserOpenId?: string | null;
  listLoading?: boolean;
  page: number;
  pageSize: number;
  createLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onCreateUser: (payload: CreateUserByMobilePayload) => Promise<void>;
  onUpdateRole: (userId: number, role: Role, payload?: BindUserRolePayload) => void;
  onDeleteUser: (userId: number) => Promise<void>;
  onQuery: (params: FetchAdminUsersParams) => void;
}) {
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPatientSource, setSelectedPatientSource] = useState<PatientSource>("PROFESSIONAL");
  const [selectedCounselorType, setSelectedCounselorType] = useState<CounselorType>("PROFESSIONAL");
  const [keywordInput, setKeywordInput] = useState("");
  const [roleGroupInput, setRoleGroupInput] = useState<RoleGroupValue>("");
  const [subtypeInput, setSubtypeInput] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const allUsers = useMemo(() => users || [], [users]);
  const subtypeOptions = useMemo(
    () => subtypeSelectOptionsForRoleGroup(roleGroupInput),
    [roleGroupInput],
  );
  const actorRole = useMemo(() => resolveHighestStaffRole(currentUserRoles), [currentUserRoles]);
  const actorIsKeyLoginAdmin = useMemo(
    () => isKeyLoginAdminOpenId(currentUserOpenId),
    [currentUserOpenId],
  );
  const manageableRoleOptions = useMemo(
    () => getManageableRoles(currentUserRoles, { actorIsKeyLoginAdmin }),
    [actorIsKeyLoginAdmin, currentUserRoles],
  );
  const filteredUsers = allUsers;
  const { currentPage, items } = getPageItems(filteredUsers, page, pageSize);

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onQuery({
      keyword: keywordInput.trim() || undefined,
      role_group: roleGroupInput || undefined,
      subtype: subtypeInput || undefined,
    });
    onPageChange(1);
  };

  const resetQuery = () => {
    setKeywordInput("");
    setRoleGroupInput("");
    setSubtypeInput("");
    onQuery({});
    onPageChange(1);
  };

  const openEditor = (user: AdminUser) => {
    const currentRole = resolveCurrentRole(user);
    const preferredRole =
      (currentRole && manageableRoleOptions.some((option) => option.value === currentRole)
        ? currentRole
        : manageableRoleOptions[0]?.value) || null;
    setEditingUser(user);
    setSelectedRole(preferredRole);
    setSelectedPatientSource(resolvePatientSource(user.patientSource));
    setSelectedCounselorType(resolveCounselorType(user.counselorType));
  };

  const closeEditor = () => {
    setEditingUser(null);
    setSelectedRole(null);
    setSelectedPatientSource("PROFESSIONAL");
    setSelectedCounselorType("PROFESSIONAL");
  };

  const saveRole = () => {
    if (!editingUser || !selectedRole) {
      return;
    }
    if (!manageableRoleOptions.some((option) => option.value === selectedRole)) {
      return;
    }

    const payload: BindUserRolePayload = {};
    if (selectedRole === "Patient") {
      payload.patient_source = selectedPatientSource;
    }
    if (selectedRole === "Counselor") {
      payload.counselor_type = selectedCounselorType;
    }

    onUpdateRole(editingUser.id, selectedRole, payload);
    closeEditor();
  };

  const canManageTarget = (user: AdminUser) => {
    if (!actorRole) {
      return false;
    }
    const targetRole = resolveCurrentRole(user);
    if (!targetRole) {
      return false;
    }
    return canActorManageUser(actorRole, targetRole, {
      actorIsKeyLoginAdmin,
      targetIsKeyLoginAdmin: !!user.isKeyLoginAdmin,
    });
  };

  const requestDelete = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      window.alert("不能删除当前登录账号");
      return;
    }
    if (!canManageTarget(user)) {
      return;
    }

    const name = getName(user) || user.mobile || `用户 ${user.id}`;
    const targetRole = resolveCurrentRole(user);
    const isTester = targetRole === "Tester";
    const confirmed = window.confirm(
      isTester
        ? `确定永久删除测试员「${name}」吗？\n\n将级联删除其咨询、订单、个案等全部业务数据及账号本身，且不可恢复。`
        : `确定永久删除「${name}」吗？\n\n该操作不可恢复。若该用户存在咨询记录或已支付订单，将无法删除。`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    try {
      await onDeleteUser(user.id);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form className="px-6 py-5 sm:px-7 lg:px-8" onSubmit={submitQuery}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">用户与角色</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              仅密钥登录管理员可新增、删除或更换其他管理员；该密钥管理员账号本身不可被删除或更换角色。普通管理员同级不可互操作。测试员可强制级联删除；普通用户若有咨询/已支付订单则无法删除。
            </p>
          </div>
          <button
            className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            disabled={manageableRoleOptions.length === 0}
            onClick={() => setCreating(true)}
          >
            新建角色
          </button>
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
          <QueryField label="角色分组">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={roleGroupInput}
              onChange={(event) => {
                const nextGroup = event.target.value as RoleGroupValue;
                setRoleGroupInput(nextGroup);
                setSubtypeInput("");
              }}
            >
              {ROLE_GROUP_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </QueryField>
          <QueryField label="具体类型">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={subtypeInput}
              disabled={subtypeOptions.length === 0}
              onChange={(event) => setSubtypeInput(event.target.value)}
            >
              {subtypeOptions.length === 0 ? (
                <option value="">请先选择咨询师或来访</option>
              ) : (
                subtypeOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
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
                items.map((user) => {
                  const manageable = canManageTarget(user);
                  const isSelf = user.id === currentUserId;
                  return (
                <tr key={user.id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="px-5 py-4">
                    {formatPatientNameWithContractTag(getName(user), user.contractTag)}
                    {isSelf ? <span className="ml-2 text-xs text-[var(--lxxl-muted)]">（当前账号）</span> : null}
                    {user.isKeyLoginAdmin ? (
                      <span className="ml-2 text-xs text-[var(--lxxl-muted)]">（密钥管理员）</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">{user.mobile || "-"}</td>
                  <td className="px-5 py-4">
                    <div>{user.activeRoleLabel || roleLabel(user.activeRole)}</div>
                    {user.patientSourceLabel && (
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">来访类别：{user.patientSourceLabel}</div>
                    )}
                    {user.counselorTypeLabel && (
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">咨询师类型：{user.counselorTypeLabel}</div>
                    )}
                  </td>
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
                    <div className="flex flex-wrap gap-2">
                      {manageable ? (
                        <TableActionButton onClick={() => openEditor(user)}>
                          修改
                        </TableActionButton>
                      ) : null}
                      {manageable && !isSelf ? (
                        <TableActionButton
                          tone="danger"
                          disabled={deletingUserId === user.id || listLoading}
                          onClick={() => void requestDelete(user)}
                        >
                          {deletingUserId === user.id ? "删除中..." : "删除"}
                        </TableActionButton>
                      ) : null}
                      {!manageable && !isSelf ? (
                        <span className="text-xs text-[var(--lxxl-muted)]">无权操作</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
                  );
                })
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
          roleOptions={manageableRoleOptions}
          selectedRole={selectedRole}
          patientSource={selectedPatientSource}
          counselorType={selectedCounselorType}
          onRoleChange={setSelectedRole}
          onPatientSourceChange={setSelectedPatientSource}
          onCounselorTypeChange={setSelectedCounselorType}
          onClose={closeEditor}
          onSave={saveRole}
        />
      )}
      {creating && (
        <RoleCreateModal
          roleOptions={manageableRoleOptions}
          submitting={createLoading}
          onClose={() => setCreating(false)}
          onCreate={onCreateUser}
        />
      )}
    </section>
  );
}

function resolveCurrentRole(user: AdminUser): Role | null {
  if (user.activeRole && user.roles.includes(user.activeRole as Role)) {
    return user.activeRole as Role;
  }
  return user.roles[0] || null;
}

function resolvePatientSource(value?: string | null): PatientSource {
  if (value === "MINI_PROGRAM") {
    return "PROFESSIONAL";
  }
  if (value?.startsWith("CHARITY_")) {
    return "CHARITY";
  }
  return PATIENT_SOURCE_OPTIONS.some((option) => option.value === value)
    ? (value as PatientSource)
    : "PROFESSIONAL";
}

function resolveCounselorType(value?: string | null): CounselorType {
  return COUNSELOR_TYPE_OPTIONS.some((option) => option.value === value) ? (value as CounselorType) : "PROFESSIONAL";
}
