"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { useRouter } from "next/navigation";

import {
  fetchUserBoard,
  fetchUserBoardDetail,
  updatePatientBoundCounselor,
  updateStaffRemark,
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
  const [remarkSavingAccountId, setRemarkSavingAccountId] = useState<number>();
  const [filters, setFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);
  const [draftFilters, setDraftFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);
  const listRequestSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const selectedAccountIdRef = useRef<number | undefined>(undefined);

  const loadData = useCallback(async () => {
    const requestSeq = listRequestSeq.current + 1;
    listRequestSeq.current = requestSeq;
    setListLoading(true);
    clearNotice();
    try {
      const userBoard = await fetchUserBoard(filters, {
        page,
        pageSize,
      });
      if (listRequestSeq.current !== requestSeq) {
        return false;
      }
      setData((prev) => ({ ...prev, userBoard }));
      return true;
    } catch (error) {
      if (listRequestSeq.current === requestSeq) {
        showNotice("error", error instanceof Error ? error.message : "来访管理加载失败");
      }
      return false;
    } finally {
      if (listRequestSeq.current === requestSeq) {
        setListLoading(false);
      }
    }
  }, [clearNotice, filters, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateFilters = useCallback((updater: SetStateAction<UserBoardFilters>) => {
    setDraftFilters(updater);
  }, []);

  const closeDetail = useCallback(() => {
    detailRequestSeq.current += 1;
    selectedAccountIdRef.current = undefined;
    setDetailLoading(false);
    setSelectedUserBoard(undefined);
  }, []);

  const openUserDetail = useCallback(async (accountId: number) => {
    const requestSeq = detailRequestSeq.current + 1;
    detailRequestSeq.current = requestSeq;
    selectedAccountIdRef.current = accountId;
    setSelectedUserBoard(undefined);
    setDetailLoading(true);
    try {
      const selectedUserBoard = await fetchUserBoardDetail(accountId);
      if (detailRequestSeq.current !== requestSeq || selectedAccountIdRef.current !== accountId) {
        return false;
      }
      setSelectedUserBoard(selectedUserBoard);
      return true;
    } catch (error) {
      if (detailRequestSeq.current === requestSeq && selectedAccountIdRef.current === accountId) {
        showNotice("error", error instanceof Error ? error.message : "来访者详情加载失败");
      }
      return false;
    } finally {
      if (detailRequestSeq.current === requestSeq) {
        setDetailLoading(false);
      }
    }
  }, [showNotice]);

  useEffect(() => {
    const selectedAccountId = selectedAccountIdRef.current;
    if (selectedAccountId) {
      void openUserDetail(selectedAccountId);
    }
  }, [openUserDetail, refreshKey]);

  const search = useCallback(() => {
    closeDetail();
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
  }, [closeDetail, draftFilters, filters, loadData, page]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_USER_BOARD_FILTERS);
    closeDetail();
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
  }, [closeDetail, filters, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const openProxyBooking = useCallback(
    (target: UserProxyBookingTarget) => {
      const params = new URLSearchParams();
      params.set("patientId", String(target.patientId));
      params.set("patientName", target.patientName);
      if (target.patientMobile) {
        params.set("patientMobile", target.patientMobile);
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
      const listSeq = listRequestSeq.current + 1;
      listRequestSeq.current = listSeq;
      const detailSeq = detailRequestSeq.current;
      const shouldRefreshDetail = selectedAccountIdRef.current === patientId;
      clearNotice();
      setListLoading(true);
      if (shouldRefreshDetail) {
        setDetailLoading(true);
      }
      try {
        const contract = await updatePatientBoundCounselor(patientId, counselorId);
        const [userBoardResult, detailResult] = await Promise.allSettled([
          fetchUserBoard(filters, { page, pageSize }),
          shouldRefreshDetail ? fetchUserBoardDetail(patientId) : Promise.resolve(undefined),
        ]);

        if (userBoardResult.status === "fulfilled" && listRequestSeq.current === listSeq) {
          setData((current) => ({ ...current, userBoard: userBoardResult.value }));
        }
        if (
          shouldRefreshDetail &&
          detailResult.status === "fulfilled" &&
          detailResult.value &&
          detailRequestSeq.current === detailSeq &&
          selectedAccountIdRef.current === patientId
        ) {
          setSelectedUserBoard(detailResult.value);
        } else if (
          shouldRefreshDetail &&
          detailResult.status === "rejected" &&
          detailRequestSeq.current === detailSeq &&
          selectedAccountIdRef.current === patientId
        ) {
          // 避免继续展示绑定操作前的订单和预约快照，用户可重新打开详情重试。
          setSelectedUserBoard(undefined);
        }

        const actionText = counselorId ? "已更新绑定咨询师" : "已解除咨询师绑定";
        const contractText = contract.isContractSigned
          ? "当前签约状态：已签约"
          : "当前签约状态：未签约，代理预约时需选择协议";
        if (
          userBoardResult.status === "rejected" ||
          (shouldRefreshDetail && detailResult.status === "rejected")
        ) {
          showNotice("info", `${actionText}，但最新数据刷新失败，请刷新页面后核对。${contractText}`);
        } else {
          showNotice("success", `${actionText}。${contractText}`);
        }
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "绑定咨询师更新失败");
        throw error;
      } finally {
        if (listRequestSeq.current === listSeq) {
          setListLoading(false);
        }
        if (detailRequestSeq.current === detailSeq) {
          setDetailLoading(false);
        }
      }
    },
    [clearNotice, filters, page, pageSize, showNotice],
  );

  const saveStaffRemark = useCallback(async (accountId: number, remark: string) => {
    clearNotice();
    setRemarkSavingAccountId(accountId);
    try {
      const saved = await updateStaffRemark(accountId, remark);
      setData((current) => ({
        ...current,
        userBoard: current.userBoard
          ? {
              ...current.userBoard,
              items: current.userBoard.items.map((item) =>
                item.id === accountId ? { ...item, staffRemark: saved.staffRemark } : item,
              ),
            }
          : current.userBoard,
      }));
      setSelectedUserBoard((current) =>
        current && current.profile.id === accountId
          ? { ...current, profile: { ...current.profile, staffRemark: saved.staffRemark } }
          : current,
      );
      showNotice("success", saved.staffRemark ? "内部备注已保存" : "内部备注已清空");
      return saved.staffRemark;
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "内部备注保存失败");
      throw error;
    } finally {
      setRemarkSavingAccountId(undefined);
    }
  }, [clearNotice, showNotice]);

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
      remarkSaving={remarkSavingAccountId === selectedUserBoard?.profile.id}
      onSaveRemark={saveStaffRemark}
    />
  );
}

function areUserBoardFiltersEqual(left: UserBoardFilters, right: UserBoardFilters) {
  return left.keyword === right.keyword && left.mobile === right.mobile;
}
