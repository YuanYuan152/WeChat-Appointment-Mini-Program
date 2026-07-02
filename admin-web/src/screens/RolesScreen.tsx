"use client";

import { useCallback, useEffect, useState } from "react";

import type { Role } from "@/types/api";

import { bindUserRole, fetchAdminUsers, unbindUserRole } from "@/services/roles";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RolesPanel } from "@/panels/RolesPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ScreenData } from "@/types/app";

export function RolesScreen() {
  return (
    <AppRoute sectionId="roles">
      <RolesScreenContent />
    </AppRoute>
  );
}

function RolesScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const adminUsers = await fetchAdminUsers();
      setData((prev) => ({ ...prev, adminUsers }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户与角色加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateRoles = (userId: number, currentRoles: Role[], nextRoles: Role[]) => {
    async function runUpdate() {
      const currentRoleSet = new Set(currentRoles);
      const nextRoleSet = new Set(nextRoles);
      const rolesToBind = nextRoles.filter((role) => !currentRoleSet.has(role));
      const rolesToUnbind = currentRoles.filter((role) => !nextRoleSet.has(role));

      if (rolesToBind.length === 0 && rolesToUnbind.length === 0) {
        showNotice("success", "角色无变化");
        return;
      }

      setListLoading(true);
      clearNotice();
      try {
        for (const role of rolesToBind) {
          await bindUserRole(userId, role);
        }
        for (const role of rolesToUnbind) {
          await unbindUserRole(userId, role);
        }
        const adminUsers = await fetchAdminUsers();
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

  return (
    <RolesPanel
      users={data.adminUsers}
      listLoading={listLoading}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onUpdateRoles={updateRoles}
    />
  );
}
