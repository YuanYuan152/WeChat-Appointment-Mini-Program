"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  AppointmentBoardPanel,
  type BoardAppointment,
  type AppointmentBoardView,
} from "@/panels/AppointmentBoardPanel";
import { RescheduleModal } from "@/panels/OpsCounselorSchedulePanel";
import { RoomDetailPanel } from "@/panels/RoomsPanel";
import { getLocalDateValue } from "@/lib/date";
import {
  changeScheduleRoom,
  createRoom,
  fetchRoomDayStatus,
  fetchRoomDetail,
  fetchRooms,
  fetchScheduleRoomOptions,
  saveRoomSlotStatuses,
  updateRoom,
} from "@/services/rooms";
import { fetchScheduleOverview } from "@/services/schedules";
import {
  fetchScheduleRescheduleOptions,
  rescheduleSchedule,
} from "@/services/schedules";
import { cancelProxyOrder } from "@/services/proxyBooking";
import type {
  Room,
  RoomDayStatus,
  RoomDetail,
  RoomSlotManualStatus,
  ScheduleOverview,
  ScheduleRoomOptions,
} from "@/types/api";

export function AppointmentBoardScreen() {
  return (
    <AppRoute sectionId="appointmentBoard">
      <AppointmentBoardScreenContent />
    </AppRoute>
  );
}

function AppointmentBoardScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [date, setDate] = useState(getLocalDateValue);
  const [view, setView] = useState<AppointmentBoardView>("room");
  const [schedules, setSchedules] = useState<ScheduleOverview>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomDayStatus, setRoomDayStatus] = useState<RoomDayStatus>();
  const [loading, setLoading] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<BoardAppointment>();
  const [selectedRoom, setSelectedRoom] = useState<RoomDetail>();
  const [roomOptions, setRoomOptions] = useState<ScheduleRoomOptions>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const [nextSchedules, nextRooms, nextRoomDayStatus] = await Promise.all([
        fetchScheduleOverview("", date, true),
        fetchRooms(),
        fetchRoomDayStatus(date),
      ]);
      setSchedules(nextSchedules);
      setRooms(nextRooms);
      setRoomDayStatus(nextRoomDayStatus);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "预约看板加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, date, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openRoom = useCallback(async (room: Room) => {
    setSelectedRoom(undefined);
    setRoomOptions(undefined);
    setDetailLoading(true);
    try {
      let roomId = room.id;
      if (!roomId) {
        const created = await createRoom({
          centerId: room.centerId,
          name: room.name,
          roomCode: room.roomCode,
          status: room.status || "AVAILABLE",
        });
        roomId = created.id;
      }
      if (!roomId) throw new Error("咨询室初始化失败");
      const detail = await fetchRoomDetail(roomId);
      setSelectedRoom(detail);
      const scheduleId = detail.current?.scheduleId;
      if (scheduleId) {
        try {
          setRoomOptions(await fetchScheduleRoomOptions(scheduleId));
        } catch {
          setRoomOptions(undefined);
        }
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, [showNotice]);

  const refreshRoomDetail = useCallback(async (roomId: number) => {
    const detail = await fetchRoomDetail(roomId);
    setSelectedRoom(detail);
    return detail;
  }, []);

  const saveRoom = useCallback(async (roomId: number, input: { name: string; status: string }) => {
    setActionLoading(true);
    try {
      await updateRoom(roomId, input);
      await refreshRoomDetail(roomId);
      await loadData();
      showNotice("success", "咨询室已更新");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询室更新失败");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }, [loadData, refreshRoomDetail, showNotice]);

  const saveSlotStatuses = useCallback(async (
    roomId: number,
    slots: Array<{ startTime: string; status: RoomSlotManualStatus }>,
  ) => {
    setActionLoading(true);
    try {
      await saveRoomSlotStatuses(roomId, slots);
      await refreshRoomDetail(roomId);
      await loadData();
      showNotice("success", "咨询室时段状态已保存");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "时段状态保存失败");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }, [loadData, refreshRoomDetail, showNotice]);

  const changeRoom = useCallback(async (scheduleId: number, roomCode: string) => {
    setActionLoading(true);
    try {
      await changeScheduleRoom(scheduleId, roomCode);
      if (selectedRoom?.id) await refreshRoomDetail(selectedRoom.id);
      await loadData();
      showNotice("success", "已调换咨询室");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "调换咨询室失败");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }, [loadData, refreshRoomDetail, selectedRoom?.id, showNotice]);

  const cancelPending = useCallback(async (appointment: BoardAppointment) => {
    clearNotice();
    try {
      await cancelProxyOrder({
        orderId: appointment.orderId || undefined,
        scheduleId: appointment.scheduleId,
      });
      showNotice("success", "待支付订单已取消");
      await loadData();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "取消订单失败");
    }
  }, [clearNotice, loadData, showNotice]);

  const submitReschedule = useCallback(async (
    input: { startTime: string; endTime: string; roomId?: string; reason: string },
  ) => {
    if (!rescheduleItem) return;
    clearNotice();
    try {
      await rescheduleSchedule(rescheduleItem.scheduleId, input);
      showNotice("success", "预约时间已更新");
      setRescheduleItem(undefined);
      await loadData();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "预约改期失败");
      throw error;
    }
  }, [clearNotice, loadData, rescheduleItem, showNotice]);

  return (
    <>
    <AppointmentBoardPanel
      date={date}
      setDate={setDate}
      view={view}
      setView={setView}
      schedules={schedules}
      rooms={rooms}
      roomDayStatus={roomDayStatus}
      loading={loading}
      onCancelPending={cancelPending}
      onOpenReschedule={setRescheduleItem}
      onOpenRoom={(room) => void openRoom(room)}
      onRefresh={() => void loadData()}
    />
    {rescheduleItem && (
      <RescheduleModal
        item={{
          id: rescheduleItem.scheduleId,
          startTime: rescheduleItem.startTime || "",
          endTime: rescheduleItem.endTime || "",
          roomName: rescheduleItem.roomName,
          centerName: rescheduleItem.centerName,
        }}
        onClose={() => setRescheduleItem(undefined)}
        onLoadOptions={fetchScheduleRescheduleOptions}
        onSubmit={submitReschedule}
      />
    )}
    {(detailLoading || selectedRoom) && (
      <DetailDrawer
        title="咨询室详情"
        closeDisabled={actionLoading}
        footer={null}
        onClose={() => {
          setSelectedRoom(undefined);
          setRoomOptions(undefined);
        }}
      >
        {detailLoading && !selectedRoom ? (
          <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
        ) : selectedRoom ? (
          <RoomDetailPanel
            actionLoading={actionLoading}
            room={selectedRoom}
            roomOptions={roomOptions}
            onChangeScheduleRoom={changeRoom}
            onClose={() => {
              setSelectedRoom(undefined);
              setRoomOptions(undefined);
            }}
            onSaveRoom={saveRoom}
            onSaveSlotStatuses={saveSlotStatuses}
          />
        ) : null}
      </DetailDrawer>
    )}
    </>
  );
}
