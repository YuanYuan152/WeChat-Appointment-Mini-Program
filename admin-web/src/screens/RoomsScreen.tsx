"use client";

import { useCallback, useEffect, useState } from "react";

import {
  changeScheduleRoom,
  createRoom,
  fetchRoomDetail,
  fetchRoomsData,
  fetchScheduleRoomOptions,
  saveRoomSlotStatuses,
  updateRoom,
} from "@/services/rooms";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { RoomsPanel } from "@/panels/RoomsPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getLocalDateValue } from "@/lib/date";
import type { Room, RoomDetail, RoomSlotManualStatus, RoomStatus, ScheduleRoomOptions } from "@/types/api";
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
  const [selectedRoom, setSelectedRoom] = useState<RoomDetail>();
  const [selectedSnapshot, setSelectedSnapshot] = useState<RoomStatus>();
  const [roomOptions, setRoomOptions] = useState<ScheduleRoomOptions>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const openRoomDetail = useCallback(async (room: Room, snapshot?: RoomStatus) => {
    setSelectedSnapshot(snapshot);
    setSelectedRoom(undefined);
    setRoomOptions(undefined);
    setDetailLoading(true);
    try {
      let roomId = room.id;
      if (!roomId) {
        const createdRoom = await createRoom({
          centerId: room.centerId,
          name: room.name,
          roomCode: room.roomCode,
          status: room.status || "AVAILABLE",
        });
        roomId = createdRoom.id || undefined;
        if (!roomId) {
          throw new Error("咨询室初始化失败，未返回数据库 ID");
        }
        void loadData();
      }
      const detail = await fetchRoomDetail(roomId);
      setSelectedRoom(detail);
      const scheduleId = snapshot?.scheduleId || detail.current?.scheduleId;
      if (scheduleId) {
        try {
          const options = await fetchScheduleRoomOptions(scheduleId);
          setRoomOptions(options);
        } catch {
          setRoomOptions(undefined);
        }
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, [loadData, showNotice]);

  const closeDetail = useCallback(() => {
    setSelectedRoom(undefined);
    setSelectedSnapshot(undefined);
    setRoomOptions(undefined);
    setDetailLoading(false);
  }, []);

  const saveRoom = useCallback(async (roomId: number, input: { name: string; status: string }) => {
    setActionLoading(true);
    try {
      await updateRoom(roomId, input);
      showNotice("success", "咨询室已更新");
      const detail = await fetchRoomDetail(roomId);
      setSelectedRoom(detail);
      void loadData();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室更新失败");
    } finally {
      setActionLoading(false);
    }
  }, [loadData, showNotice]);

  const addRoom = useCallback(async (input: { centerId: string; name: string; roomCode?: string; status: string }) => {
    setActionLoading(true);
    try {
      await createRoom(input);
      showNotice("success", "咨询室已新增");
      void loadData();
      return true;
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室新增失败");
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [loadData, showNotice]);

  const changeRoomForSchedule = useCallback(async (scheduleId: number, roomCode: string) => {
    setActionLoading(true);
    try {
      await changeScheduleRoom(scheduleId, roomCode);
      showNotice("success", "已调换咨询室");
      void loadData();
      if (selectedRoom?.id) {
        const detail = await fetchRoomDetail(selectedRoom.id);
        setSelectedRoom(detail);
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "调换咨询室失败");
    } finally {
      setActionLoading(false);
    }
  }, [loadData, selectedRoom, showNotice]);

  const saveSlotStatuses = useCallback(
    async (roomId: number, slots: Array<{ startTime: string; status: RoomSlotManualStatus }>) => {
      setActionLoading(true);
      try {
        await saveRoomSlotStatuses(roomId, slots);
        showNotice("success", "时段状态已保存");
        const detail = await fetchRoomDetail(roomId);
        setSelectedRoom(detail);
        void loadData();
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "时段状态保存失败");
      } finally {
        setActionLoading(false);
      }
    },
    [loadData, showNotice],
  );

  return (
    <RoomsPanel
      rooms={data.rooms}
      roomStatus={data.roomStatus}
      listLoading={listLoading}
      detailLoading={detailLoading}
      actionLoading={actionLoading}
      selectedRoom={selectedRoom}
      selectedSnapshot={selectedSnapshot}
      roomOptions={roomOptions}
      filters={draftFilters}
      setFilters={setDraftFilters}
      page={page}
      pageSize={pageSize}
      onSearch={search}
      onReset={resetFilters}
      onOpenRoom={openRoomDetail}
      onCloseDetail={closeDetail}
      onSaveRoom={saveRoom}
      onSaveSlotStatuses={saveSlotStatuses}
      onAddRoom={addRoom}
      onChangeScheduleRoom={changeRoomForSchedule}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
    />
  );
}
