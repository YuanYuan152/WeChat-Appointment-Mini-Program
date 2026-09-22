"use client";

import { useMemo } from "react";

import { Badge, EmptyState, QueryButton, QueryField, queryControlClass } from "@/components/ui";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { Room, ScheduleItem, ScheduleOverview } from "@/types/api";

export type AppointmentBoardView = "room" | "list";

type BoardAppointment = ScheduleItem & {
  counselorId: number;
  counselorName: string;
};

type BoardRoom = {
  key: string;
  centerId: string;
  centerName: string;
  roomId: string;
  roomName: string;
};

const START_MINUTES = 9 * 60;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 52;
const COLOR_PALETTE = [
  ["#FFF2B8", "#725800"],
  ["#DDF3D5", "#315F2B"],
  ["#DCEBFF", "#24548C"],
  ["#FBE1EC", "#853759"],
  ["#E9DFF8", "#62458A"],
  ["#D9F2EF", "#276B63"],
  ["#FFE5CF", "#8B4B1B"],
] as const;

export function AppointmentBoardPanel({
  date,
  setDate,
  view,
  setView,
  schedules,
  rooms,
  loading,
  onRefresh,
}: {
  date: string;
  setDate: (value: string) => void;
  view: AppointmentBoardView;
  setView: (value: AppointmentBoardView) => void;
  schedules?: ScheduleOverview;
  rooms: Room[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const appointments = useMemo(() => flattenAppointments(schedules), [schedules]);
  const boardRooms = useMemo(() => buildBoardRooms(rooms, appointments), [appointments, rooms]);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="px-6 py-5 sm:px-7 lg:px-8">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">预约看板</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            按日期查看全部预约；咨询室视图展示空间占用，列表视图展示预约状态与明细。
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <QueryField label="日期" required>
            <input
              className={`${queryControlClass} min-w-52`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </QueryField>
          <QueryButton disabled={loading} onClick={onRefresh}>
            {loading ? "加载中" : "刷新"}
          </QueryButton>
          <div className="ml-auto flex rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-1">
            {([
              ["room", "咨询室视图"],
              ["list", "列表视图"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === value
                    ? "bg-[var(--lxxl-green)] text-white shadow-sm"
                    : "text-[var(--lxxl-muted)] hover:text-[var(--lxxl-green)]"
                }`}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !schedules ? (
        <EmptyState text="正在加载预约看板..." />
      ) : view === "room" ? (
        <RoomBoard date={date} rooms={boardRooms} appointments={appointments} />
      ) : (
        <AppointmentList appointments={appointments} />
      )}
    </section>
  );
}

function RoomBoard({
  date,
  rooms,
  appointments,
}: {
  date: string;
  rooms: BoardRoom[];
  appointments: BoardAppointment[];
}) {
  const timeSlots = buildTimeSlots();
  const groups = groupRooms(rooms);
  const columnWidth = 156;
  const bodyHeight = timeSlots.length * SLOT_HEIGHT;

  if (rooms.length === 0) {
    return <EmptyState text="暂无咨询室配置。" />;
  }

  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 136 + rooms.length * columnWidth }}>
          <div className="flex border-b border-[var(--lxxl-border)] bg-[#FAF8F4]">
            <div className="flex w-[136px] shrink-0 items-center justify-center border-r border-[var(--lxxl-border)] px-3 py-4 text-center text-sm font-medium">
              <span>{date}</span>
            </div>
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(${columnWidth}px, 1fr))` }}
            >
              {groups.map((group) => (
                <div
                  key={group.centerId}
                  className="border-r border-[var(--lxxl-border)]"
                  style={{ gridColumn: `span ${group.rooms.length}` }}
                >
                  <div className="border-b border-[var(--lxxl-border)] px-3 py-3 text-center text-sm font-semibold">
                    {group.centerName}
                  </div>
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${group.rooms.length}, minmax(${columnWidth}px, 1fr))` }}
                  >
                    {group.rooms.map((room) => (
                      <div
                        key={room.key}
                        className="border-r border-[var(--lxxl-border)] px-2 py-3 text-center text-sm last:border-r-0"
                      >
                        {room.roomName}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
            <div className="relative w-[136px] shrink-0 border-r border-[var(--lxxl-border)]" style={{ height: bodyHeight }}>
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="absolute inset-x-0 border-b border-[var(--lxxl-border)] px-3 pt-4 text-center text-sm text-[var(--lxxl-muted)]"
                  style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                >
                  {slot}
                </div>
              ))}
            </div>
            <div
              className="grid flex-1"
              style={{
                gridTemplateColumns: `repeat(${rooms.length}, minmax(${columnWidth}px, 1fr))`,
                height: bodyHeight,
              }}
            >
              {rooms.map((room) => {
                const roomAppointments = appointments.filter(
                  (item) => appointmentRoomKey(item) === room.key && !isCancelled(item),
                );
                return (
                  <div
                    key={room.key}
                    className="relative border-r border-[var(--lxxl-border)]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_HEIGHT - 1}px, var(--lxxl-border) ${SLOT_HEIGHT - 1}px, var(--lxxl-border) ${SLOT_HEIGHT}px)`,
                    }}
                  >
                    {roomAppointments.map((appointment) => (
                      <AppointmentBlock key={appointment.scheduleId} appointment={appointment} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentBlock({ appointment }: { appointment: BoardAppointment }) {
  const start = minutesOfDay(appointment.startTime);
  const end = minutesOfDay(appointment.endTime);
  const visibleStart = Math.max(start, START_MINUTES);
  const visibleEnd = Math.min(Math.max(end, visibleStart + SLOT_MINUTES), END_MINUTES);
  if (visibleStart >= END_MINUTES || visibleEnd <= START_MINUTES) return null;

  const top = ((visibleStart - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT + 3;
  const height = Math.max(46, ((visibleEnd - visibleStart) / SLOT_MINUTES) * SLOT_HEIGHT - 6);
  const [background, color] = COLOR_PALETTE[Math.abs(appointment.scheduleId) % COLOR_PALETTE.length];
  const patient = formatPatientNameWithContractTag(
    appointment.patientName,
    appointment.patientContractTag,
  ) || "来访";

  return (
    <div
      className="absolute inset-x-1 z-10 overflow-hidden rounded-md border border-black/5 px-2 py-1.5 text-xs leading-5 shadow-sm"
      style={{ top, height, background, color }}
      title={`${appointment.counselorName} - ${patient}`}
    >
      <div className="font-semibold">{appointment.counselorName} - {patient}</div>
      <div className="opacity-75">{timeText(appointment.startTime)}-{timeText(appointment.endTime)}</div>
    </div>
  );
}

function AppointmentList({ appointments }: { appointments: BoardAppointment[] }) {
  if (appointments.length === 0) {
    return <EmptyState text="当日暂无预约。" />;
  }
  return (
    <div className="overflow-x-auto border-t border-[var(--lxxl-border)]">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
          <tr>
            <th className="px-5 py-3 font-medium">预约时间</th>
            <th className="px-5 py-3 font-medium">状态</th>
            <th className="px-5 py-3 font-medium">咨询师</th>
            <th className="px-5 py-3 font-medium">来访者</th>
            <th className="px-5 py-3 font-medium">咨询中心</th>
            <th className="px-5 py-3 font-medium">咨询室</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((item) => (
            <tr key={item.scheduleId} className="border-t border-[var(--lxxl-border)]">
              <td className="whitespace-nowrap px-5 py-4 font-medium">
                {timeText(item.startTime)} - {timeText(item.endTime)}
              </td>
              <td className="px-5 py-4">
                <Badge tone={statusTone(effectiveStatus(item))}>
                  {boardStatusLabel(effectiveStatus(item))}
                </Badge>
              </td>
              <td className="px-5 py-4">{item.counselorName}</td>
              <td className="px-5 py-4">
                {formatPatientNameWithContractTag(item.patientName, item.patientContractTag) || "-"}
              </td>
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.centerName || "-"}</td>
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.roomName || (item.centerId === "video" ? "视频咨询" : "未分配")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function flattenAppointments(schedules?: ScheduleOverview): BoardAppointment[] {
  return (schedules?.counselors || [])
    .flatMap((counselor) =>
      counselor.schedules
        .filter((item) => isAppointment(item))
        .map((item) => ({
          ...item,
          counselorId: counselor.counselorId,
          counselorName: counselor.counselorName,
        })),
    )
    .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
}

function isAppointment(item: ScheduleItem) {
  return Boolean(item.consultationId || item.patientName)
    || ["BOOKED", "CONFIRMED", "ONGOING", "DONE", "CANCELLED", "CANCELED"].includes(item.status);
}

function effectiveStatus(item: ScheduleItem) {
  return item.consultationStatus || item.status;
}

function isCancelled(item: ScheduleItem) {
  return ["CANCELLED", "CANCELED"].includes(String(effectiveStatus(item)).toUpperCase());
}

function buildBoardRooms(rooms: Room[], appointments: BoardAppointment[]): BoardRoom[] {
  const physical = rooms
    .filter((room) => room.status !== "DELETED")
    .sort((a, b) =>
      `${a.centerName}-${a.name}`.localeCompare(`${b.centerName}-${b.name}`, "zh-CN"),
    )
    .map((room) => ({
      key: `${room.centerId}:${room.roomCode}`,
      centerId: room.centerId,
      centerName: room.centerName,
      roomId: room.roomCode,
      roomName: room.name,
    }));
  const result = [...physical];
  if (appointments.some((item) => item.centerId === "video")) {
    result.push({
      key: "video:video",
      centerId: "video",
      centerName: "视频咨询",
      roomId: "video",
      roomName: "视频咨询",
    });
  }
  if (appointments.some((item) => !result.some((room) => room.key === appointmentRoomKey(item)))) {
    result.push({
      key: "unassigned:unassigned",
      centerId: "unassigned",
      centerName: "其他",
      roomId: "unassigned",
      roomName: "未分配咨询室",
    });
  }
  return result;
}

function appointmentRoomKey(item: BoardAppointment) {
  if (item.centerId === "video") return "video:video";
  if (!item.centerId || !item.roomId) return "unassigned:unassigned";
  return `${item.centerId}:${item.roomId}`;
}

function groupRooms(rooms: BoardRoom[]) {
  const groups: Array<{ centerId: string; centerName: string; rooms: BoardRoom[] }> = [];
  rooms.forEach((room) => {
    const existing = groups.find((group) => group.centerId === room.centerId);
    if (existing) existing.rooms.push(room);
    else groups.push({ centerId: room.centerId, centerName: room.centerName, rooms: [room] });
  });
  return groups;
}

function buildTimeSlots() {
  const slots: string[] = [];
  for (let minutes = START_MINUTES; minutes < END_MINUTES; minutes += SLOT_MINUTES) {
    slots.push(`${formatMinutes(minutes)}-${formatMinutes(minutes + SLOT_MINUTES)}`);
  }
  return slots;
}

function minutesOfDay(value?: string | null) {
  const time = String(value || "").slice(11, 16);
  const [hour, minute] = time.split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : START_MINUTES;
}

function formatMinutes(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeText(value?: string | null) {
  return String(value || "").slice(11, 16) || "-";
}

function boardStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    BOOKED: "已预约",
    CONFIRMED: "已确认",
    ONGOING: "进行中",
    DONE: "已完成",
    CANCELLED: "已取消",
    CANCELED: "已取消",
    ON_LEAVE: "已请假",
  };
  return labels[String(status || "").toUpperCase()] || status || "未知";
}

function statusTone(status?: string | null): "green" | "gold" | "red" | "neutral" {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DONE") return "green";
  if (["CANCELLED", "CANCELED", "ON_LEAVE"].includes(normalized)) return "red";
  if (["BOOKED", "CONFIRMED", "ONGOING"].includes(normalized)) return "gold";
  return "neutral";
}
