"use client";

import { useCallback, useEffect, useState } from "react";
import type { SetStateAction } from "react";
import { useRouter } from "next/navigation";

import {
  fetchUserBoard,
  fetchUserBoardDetail,
  updatePatientBoundCounselor,
} from "@/services/boards";
import { searchProxyCounselors } from "@/services/proxyBooking";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { UserBoardPanel, type UserProxyBookingTarget } from "@/panels/UserBoardPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ProxyPersonOption, UserBoardDetail } from "@/types/api";
import type { ScreenData, UserBoardFilters } from "@/types/app";

const INITIAL_USER_BOARD_FILTERS: UserBoardFilters = {
  keyword: "",
  mobile: "",
};

export function UserBoardScreen() {
  return (
    <AppRoute sectionId="userBoard">
      <UserBoardScreenContent />
    </AppRoute>
  );
}

function UserBoardScreenContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [selectedUserBoard, setSelectedUserBoard] = useState<UserBoardDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);
  const [draftFilters, setDraftFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const userBoard = await fetchUserBoard(filters, {
        page,
        pageSize,
      });
      setData((prev) => ({ ...prev, userBoard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户管理加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, filters, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateFilters = useCallback((updater: SetStateAction<UserBoardFilters>) => {
    setDraftFilters(updater);
  }, []);

  const openUserDetail = useCallback(async (accountId: number) => {
    setSelectedUserBoard(undefined);
    setDetailLoading(true);
    try {
      const selectedUserBoard = await fetchUserBoardDetail(accountId);
      setSelectedUserBoard(selectedUserBoard);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, [showNotice]);

  const search = useCallback(() => {
    setSelectedUserBoard(undefined);
    if (page === 1) {
      if (areUserBoardFiltersEqual(filters, draftFilters)) {
        void loadData();
      } else {
        setFilters(draftFilters);
      }
      return;
    }
    setPage(1);
    setFilters(draftFilters);
  }, [draftFilters, filters, loadData, page]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_USER_BOARD_FILTERS);
    setSelectedUserBoard(undefined);
    if (page === 1) {
      if (areUserBoardFiltersEqual(filters, INITIAL_USER_BOARD_FILTERS)) {
        void loadData();
      } else {
        setFilters(INITIAL_USER_BOARD_FILTERS);
      }
      return;
    }
    setPage(1);
    setFilters(INITIAL_USER_BOARD_FILTERS);
  }, [filters, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailLoading(false);
    setSelectedUserBoard(undefined);
  }, []);

  const openProxyBooking = useCallback(
    (target: UserProxyBookingTarget) => {
      const params = new URLSearchParams();
      params.set("patientId", String(target.patientId));
      params.set("patientName", target.patientName);
      if (target.patientMobile) {
        params.set("patientMobile", target.patientMobile);
      }
      params.set("isContractSigned", target.isContractSigned ? "1" : "0");
      if (target.boundCounselorId) {
        params.set("boundCounselorId", String(target.boundCounselorId));
      }
      if (target.boundCounselorName) {
        params.set("boundCounselorName", target.boundCounselorName);
      }
      if (target.counselorId) {
        params.set("counselorId", String(target.counselorId));
        params.set("counselorName", target.counselorName || `咨询师#${target.counselorId}`);
      }
      if (target.counselorMobile) {
        params.set("counselorMobile", target.counselorMobile);
      }
      router.push(`/proxy-booking?${params.toString()}`);
    },
    [router],
  );

  const searchCounselors = useCallback(async (keyword: string): Promise<ProxyPersonOption[]> => {
    const result = await searchProxyCounselors(keyword);
    return result.items || [];
  }, []);

  const bindCounselor = useCallback(
    async (patientId: number, counselorId: number | null) => {
      clearNotice();
      try {
        const contract = await updatePatientBoundCounselor(patientId, counselorId);
        setSelectedUserBoard((current) => {
          if (!current || current.profile.id !== patientId) {
            return current;
          }
          return {
            ...current,
            profile: {
              ...current.profile,
              isContractSigned: contract.isContractSigned,
              boundCounselorId: contract.boundCounselorId,
              boundCounselorName: contract.boundCounselorName,
              contractTag: contract.contractTag,
            },
          };
        });
        showNotice("success", counselorId ? "已更新签约咨询师" : "已解除咨询师绑定");
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "签约咨询师更新失败");
        throw error;
      }
    },
    [clearNotice, showNotice],
  );

  return (
    <UserBoardPanel
      users={data.userBoard}
      listLoading={listLoading}
      selected={selectedUserBoard}
      detailLoading={detailLoading}
      filters={draftFilters}
      setFilters={updateFilters}
      onSearch={search}
      onReset={resetFilters}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onOpen={openUserDetail}
      onCloseDetail={closeDetail}
      onProxyBooking={openProxyBooking}
      onSearchCounselors={searchCounselors}
      onBindCounselor={bindCounselor}
    />
  );
}

function areUserBoardFiltersEqual(left: UserBoardFilters, right: UserBoardFilters) {
  return left.keyword === right.keyword && left.mobile === right.mobile;
}
