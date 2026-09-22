"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import {
  AppointmentBoardPanel,
  type AppointmentBoardView,
} from "@/panels/AppointmentBoardPanel";
import { getLocalDateValue } from "@/lib/date";
import { fetchRoomDayStatus, fetchRooms } from "@/services/rooms";
import { fetchScheduleOverview } from "@/services/schedules";
import type { Room, RoomDayStatus, ScheduleOverview } from "@/types/api";

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

  return (
    <AppointmentBoardPanel
      date={date}
      setDate={setDate}
      view={view}
      setView={setView}
      schedules={schedules}
      rooms={rooms}
      roomDayStatus={roomDayStatus}
      loading={loading}
      onRefresh={() => void loadData()}
    />
  );
}
