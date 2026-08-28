"use client";

import { useCallback, useEffect, useState } from "react";

import type { Role } from "@/types/api";

import {
  bindUserRole,
  createUserByMobile,
  deleteUser,
  fetchAdminUsers,
  type BindUserRolePayload,
  type CreateUserByMobilePayload,
  type FetchAdminUsersParams,
} from "@/services/roles";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RolesPanel } from "@/panels/RolesPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getMessage } from "@/lib/display";
import type { ScreenData } from "@/types/app";

export function RolesScreen() {
  return (
    <AppRoute sectionId="roles">
      <RolesScreenContent />
    </AppRoute>
  );
}

function RolesScreenContent() {
  const { clearNotice, currentUser, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [queryParams, setQueryParams] = useState<FetchAdminUsersParams>({});

  const loadData = useCallback(async (params: FetchAdminUsersParams = queryParams) => {
    setListLoading(true);
    clearNotice();
    try {
      const adminUsers = await fetchAdminUsers({
        ...params,
        page: 1,
        page_size: 500,
      });
      setData((prev) => ({ ...prev, adminUsers }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户与角色加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryParams, showNotice]);

  useEffect(() => {
    void loadData(queryParams);
  }, [loadData, queryParams, refreshKey]);

  const updateRole = (userId: number, role: Role, payload: BindUserRolePayload = {}) => {
    async function runUpdate() {
      setListLoading(true);
      clearNotice();
      try {
        await bindUserRole(userId, role, payload);
        const adminUsers = await fetchAdminUsers({ ...queryParams, page: 1, page_size: 500 });
        setData((prev) => ({ ...prev, adminUsers }));
        showNotice("success", "角色已更新");
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "角色更新失败");
      } finally {
        setListLoading(false);
      }
    }

    void runUpdate();
  };

  const createUser = async (payload: CreateUserByMobilePayload) => {
    setCreateLoading(true);
    clearNotice();
    try {
      const result = await createUserByMobile(payload);
      const adminUsers = await fetchAdminUsers({ ...queryParams, page: 1, page_size: 500 });
      setData((prev) => ({ ...prev, adminUsers }));
      setPage(1);
      showNotice("success", getMessage(result, result.created ? "用户已添加" : "已绑定角色"));
    } finally {
      setCreateLoading(false);
    }
  };

  const removeUser = async (userId: number) => {
    setListLoading(true);
    clearNotice();
    try {
      const result = await deleteUser(userId);
      const adminUsers = await fetchAdminUsers({ ...queryParams, page: 1, page_size: 500 });
      setData((prev) => ({ ...prev, adminUsers }));
      showNotice("success", result.message || "用户已永久删除");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "删除失败");
      throw error;
    } finally {
      setListLoading(false);
    }
  };

  return (
    <RolesPanel
      users={data.adminUsers}
      currentUserId={currentUser.id}
      currentUserRoles={currentUser.roles}
      currentUserOpenId={currentUser.openId}
      listLoading={listLoading}
      page={page}
      pageSize={pageSize}
      createLoading={createLoading}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onCreateUser={createUser}
      onUpdateRole={updateRole}
      onDeleteUser={removeUser}
      onQuery={(params) => setQueryParams(params)}
    />
  );
}
