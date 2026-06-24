"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchRoomsData } from "@/services/rooms";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RoomsPanel } from "@/panels/RoomsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getLocalDateValue } from "@/lib/date";
import type { RoomFilters, ScreenData } from "@/types/app";

function getInitialRoomFilters(): RoomFilters {
  return {
    centerId: "",
    date: getLocalDateValue(),
    timeSlot: "",
  };
}

function isSameRoomFilters(a: RoomFilters, b: RoomFilters) {
  return a.centerId === b.centerId && a.date === b.date && a.timeSlot === b.timeSlot;
}

export function RoomsScreen() {
  return (
    <AppRoute sectionId="rooms">
      <RoomsScreenContent />
    </AppRoute>
  );
}

function RoomsScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [draftFilters, setDraftFilters] = useState<RoomFilters>(() => getInitialRoomFilters());
  const [queryFilters, setQueryFilters] = useState<RoomFilters>(() => getInitialRoomFilters());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const { rooms, roomStatus } = await fetchRoomsData(queryFilters);
      setData((prev) => ({ ...prev, rooms, roomStatus }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室情况加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryFilters, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const search = useCallback(() => {
    setPage(1);
    if (isSameRoomFilters(draftFilters, queryFilters)) {
      void loadData();
      return;
    }
    setQueryFilters(draftFilters);
  }, [draftFilters, loadData, queryFilters]);

  const resetFilters = useCallback(() => {
    const initialFilters = getInitialRoomFilters();
    setDraftFilters(initialFilters);
    setPage(1);
    if (isSameRoomFilters(queryFilters, initialFilters)) {
      void loadData();
      return;
    }
    setQueryFilters(initialFilters);
  }, [loadData, queryFilters]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <RoomsPanel
      rooms={data.rooms}
      roomStatus={data.roomStatus}
      listLoading={listLoading}
      filters={draftFilters}
      setFilters={setDraftFilters}
      page={page}
      pageSize={pageSize}
      onSearch={search}
      onReset={resetFilters}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}
