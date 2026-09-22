"use client";

import { useMemo, useState } from "react";

import {
  EmptyState,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { Room, RoomDayStatus, ScheduleItem, ScheduleOverview } from "@/types/api";

export type AppointmentBoardView = "room" | "list";

export type BoardAppointment = ScheduleItem & {
  counselorId: number;
  counselorName: string;
};

type BoardRoom = {
  key: string;
  databaseId?: number | null;
  centerId: string;
  centerName: string;
  roomId: string;
  roomName: string;
  status: string;
};

const START_MINUTES = 9 * 60;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 52;
type BoardDisplayStatus =
  | "PENDING_PAYMENT"
  | "BOOKED"
  | "CANCELLED"
  | "ONGOING"
  | "RECORD_PENDING"
  | "RECORD_COMPLETED";

const STATUS_META: Record<BoardDisplayStatus, { label: string; background: string; color: string }> = {
  PENDING_PAYMENT: { label: "待支付", background: "#EEEEEE", color: "#555555" },
  BOOKED: { label: "已预约", background: "#FBE1E1", color: "#7B4545" },
  CANCELLED: { label: "已取消", background: "#DDE7FA", color: "#405779" },
  ONGOING: { label: "进行中", background: "#FFF2C9", color: "#755E18" },
  RECORD_PENDING: { label: "待填写咨询记录", background: "#FCE7CF", color: "#7B5427" },
  RECORD_COMPLETED: { label: "已完成咨询记录", background: "#DDF2D8", color: "#356433" },
};

export function AppointmentBoardPanel({
  date,
  setDate,
  view,
  setView,
  schedules,
  rooms,
  roomDayStatus,
  loading,
  onRefresh,
  onOpenRoom,
  onCancelPending,
  onOpenReschedule,
}: {
  date: string;
  setDate: (value: string) => void;
  view: AppointmentBoardView;
  setView: (value: AppointmentBoardView) => void;
  schedules?: ScheduleOverview;
  rooms: Room[];
  roomDayStatus?: RoomDayStatus;
  loading: boolean;
  onRefresh: () => void;
  onOpenRoom: (room: Room) => void;
  onCancelPending: (appointment: BoardAppointment) => Promise<void>;
  onOpenReschedule: (appointment: BoardAppointment) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<BoardDisplayStatus | "">("");
  const [consultationIdQuery, setConsultationIdQuery] = useState("");
  const appointments = useMemo(() => flattenAppointments(schedules), [schedules]);
  const boardRooms = useMemo(() => buildBoardRooms(rooms, appointments), [appointments, rooms]);
  const filteredAppointments = useMemo(
    () => appointments.filter((item) => {
      if (statusFilter && displayStatus(item) !== statusFilter) return false;
      const query = consultationIdQuery.trim();
      return !query || String(item.consultationId || "").includes(query);
    }),
    [appointments, consultationIdQuery, statusFilter],
  );

  const openAppointmentStatus = (appointment: BoardAppointment) => {
    setStatusFilter(displayStatus(appointment));
    setConsultationIdQuery(appointment.consultationId ? String(appointment.consultationId) : "");
    setView("list");
  };

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
              ["list", "预约状态视图"],
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
        <RoomBoard
          date={date}
          rooms={boardRooms}
          appointments={appointments}
          roomDayStatus={roomDayStatus}
          onOpenAppointment={openAppointmentStatus}
          onOpenRoom={onOpenRoom}
        />
      ) : (
        <AppointmentList
          appointments={filteredAppointments}
          consultationIdQuery={consultationIdQuery}
          statusFilter={statusFilter}
          setConsultationIdQuery={setConsultationIdQuery}
          setStatusFilter={setStatusFilter}
          onCancelPending={onCancelPending}
          onOpenReschedule={onOpenReschedule}
        />
      )}
    </section>
  );
}

function RoomBoard({
  date,
  rooms,
  appointments,
  roomDayStatus,
  onOpenAppointment,
  onOpenRoom,
}: {
  date: string;
  rooms: BoardRoom[];
  appointments: BoardAppointment[];
  roomDayStatus?: RoomDayStatus;
  onOpenAppointment: (appointment: BoardAppointment) => void;
  onOpenRoom: (room: Room) => void;
}) {
  const timeSlots = buildTimeSlots();
  const groups = groupRooms(rooms);
  const columnWidth = 156;
  const bodyHeight = timeSlots.length * SLOT_HEIGHT;

  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--lxxl-border)] bg-white px-5 py-3">
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <div className="flex items-center gap-2 text-xs text-[var(--lxxl-muted)]" key={status}>
            <span className="h-3 w-7 rounded-full" style={{ background: meta.background }} />
            <span>{meta.label}</span>
          </div>
        ))}
      </div>
      <div className="max-h-[calc(100vh-190px)] overflow-auto">
        <div style={{ minWidth: 136 + rooms.length * columnWidth }}>
          <div className="sticky top-0 z-30 flex border-b border-[var(--lxxl-border)] bg-[#FAF8F4] shadow-sm">
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
                        {room.centerId === "video" || room.centerId === "unassigned" ? (
                          room.roomName
                        ) : (
                          <button
                            type="button"
                            className="w-full rounded-lg border border-[var(--lxxl-border)] bg-white px-2 py-1.5 font-medium transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
                            onClick={() => onOpenRoom(boardRoomToRoom(room))}
                          >
                            {room.roomName}
                          </button>
                        )}
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
                  (item) => appointmentRoomKey(item) === room.key,
                );
                return (
                  <div
                    key={room.key}
                    className="border-r border-[var(--lxxl-border)]"
                  >
                    {timeSlots.map((slot) => {
                      const slotStart = minutesFromSlotLabel(slot);
                      const slotAppointments = roomAppointments.filter((appointment) =>
                        appointmentOverlapsSlot(appointment, slotStart),
                      );
                      const unavailable = roomSlotStatus(roomDayStatus, room, slotStart) !== "AVAILABLE";
                      return (
                        <div
                          key={`${room.key}-${slot}`}
                          className={`flex flex-col justify-center gap-1 overflow-hidden border-b border-[var(--lxxl-border)] px-1.5 py-1 ${
                            unavailable ? "bg-[#F6F3EE]" : ""
                          }`}
                          style={{ height: SLOT_HEIGHT }}
                        >
                          {slotAppointments.length > 0 ? (
                            slotAppointments.map((appointment) => (
                              <AppointmentSlotBar
                                key={`${appointment.scheduleId}-${slot}`}
                                appointment={appointment}
                                onClick={() => onOpenAppointment(appointment)}
                              />
                            ))
                          ) : unavailable ? (
                            <div className="rounded-full bg-[#E5E0D8] px-2 py-1 text-center text-xs font-medium text-[#756F67]">
                              不可用
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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

function AppointmentSlotBar({
  appointment,
  onClick,
}: {
  appointment: BoardAppointment;
  onClick: () => void;
}) {
  const meta = STATUS_META[displayStatus(appointment)];
  const patient = formatPatientNameWithContractTag(
    appointment.patientName,
    appointment.patientContractTag,
  ) || "来访";

  return (
    <button
      type="button"
      className="min-h-7 w-full truncate rounded-full border border-black/5 px-2 py-1 text-center text-xs font-medium leading-5 shadow-sm transition hover:brightness-95"
      style={{ background: meta.background, color: meta.color }}
      title={`${appointment.counselorName} - ${patient} ${timeText(appointment.startTime)}-${timeText(appointment.endTime)}`}
      onClick={onClick}
    >
      {appointment.counselorName} - {patient}
    </button>
  );
}

function AppointmentList({
  appointments,
  statusFilter,
  consultationIdQuery,
  setStatusFilter,
  setConsultationIdQuery,
  onCancelPending,
  onOpenReschedule,
}: {
  appointments: BoardAppointment[];
  statusFilter: BoardDisplayStatus | "";
  consultationIdQuery: string;
  setStatusFilter: (value: BoardDisplayStatus | "") => void;
  setConsultationIdQuery: (value: string) => void;
  onCancelPending: (appointment: BoardAppointment) => Promise<void>;
  onOpenReschedule: (appointment: BoardAppointment) => void;
}) {
  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--lxxl-border)] bg-[#FAF8F4] px-5 py-4">
        <QueryField label="预约状态">
          <select
            className={`${queryControlClass} min-w-48`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as BoardDisplayStatus | "")}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
        </QueryField>
        <QueryField label="咨询 ID">
          <input
            className={`${queryControlClass} min-w-48`}
            inputMode="numeric"
            placeholder="输入咨询 ID"
            value={consultationIdQuery}
            onChange={(event) => setConsultationIdQuery(event.target.value.replace(/\D/g, ""))}
          />
        </QueryField>
        <QueryResetButton
          onClick={() => {
            setStatusFilter("");
            setConsultationIdQuery("");
          }}
        >
          重置
        </QueryResetButton>
      </div>
      {appointments.length === 0 ? (
        <EmptyState text="没有符合条件的预约。" />
      ) : (
      <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
          <tr>
            <th className="px-5 py-3 font-medium">预约时间</th>
            <th className="px-5 py-3 font-medium">咨询 ID</th>
            <th className="px-5 py-3 font-medium">状态</th>
            <th className="px-5 py-3 font-medium">咨询师</th>
            <th className="px-5 py-3 font-medium">来访者</th>
            <th className="px-5 py-3 font-medium">咨询中心</th>
            <th className="px-5 py-3 font-medium">咨询室</th>
            <th className="px-5 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((item) => (
            <tr key={item.scheduleId} className="border-t border-[var(--lxxl-border)]">
              <td className="whitespace-nowrap px-5 py-4 font-medium">
                {timeText(item.startTime)} - {timeText(item.endTime)}
              </td>
              <td className="px-5 py-4">{item.consultationId || "-"}</td>
              <td className="px-5 py-4">
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    background: STATUS_META[displayStatus(item)].background,
                    color: STATUS_META[displayStatus(item)].color,
                  }}
                >
                  {STATUS_META[displayStatus(item)].label}
                </span>
              </td>
              <td className="px-5 py-4">{item.counselorName}</td>
              <td className="px-5 py-4">
                {formatPatientNameWithContractTag(item.patientName, item.patientContractTag) || "-"}
              </td>
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.centerName || "-"}</td>
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.roomName || (item.centerId === "video" ? "视频咨询" : "未分配")}</td>
              <td className="px-5 py-4 text-right">
                <div className="flex justify-end gap-2">
                  {displayStatus(item) === "PENDING_PAYMENT" && item.canCancelPending && (
                    <TableActionButton
                      onClick={() => {
                        if (window.confirm("确认取消该待支付订单？")) void onCancelPending(item);
                      }}
                    >
                      取消
                    </TableActionButton>
                  )}
                  {canRescheduleAppointment(item) && (
                    <TableActionButton onClick={() => onOpenReschedule(item)}>
                      重新选择时间
                    </TableActionButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}
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
  return Boolean(item.consultationId || item.orderId || item.patientName)
    || ["BOOKED", "CONFIRMED", "ONGOING", "DONE", "CANCELLED", "CANCELED"].includes(item.status);
}

function effectiveStatus(item: ScheduleItem) {
  return item.consultationStatus || item.status;
}

function displayStatus(item: BoardAppointment): BoardDisplayStatus {
  const orderStatus = String(item.orderStatus || "").toUpperCase();
  const status = String(effectiveStatus(item) || "").toUpperCase();
  if (orderStatus === "PENDING") return "PENDING_PAYMENT";
  if (
    ["CANCELLED", "CANCELED", "REFUNDED", "CLOSED"].includes(orderStatus)
    || ["CANCELLED", "CANCELED"].includes(status)
  ) {
    return "CANCELLED";
  }
  const now = Date.now();
  const start = new Date(item.startTime || "").getTime();
  const end = new Date(item.endTime || "").getTime();
  if (status === "ONGOING" || (Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end)) {
    return "ONGOING";
  }
  if (Number.isFinite(end) && end <= now) {
    return item.caseRecordId ? "RECORD_COMPLETED" : "RECORD_PENDING";
  }
  return "BOOKED";
}

function canRescheduleAppointment(item: BoardAppointment) {
  return displayStatus(item) === "BOOKED"
    && new Date(item.startTime || "").getTime() > Date.now()
    && Boolean(item.consultationId)
    && ["PENDING", "CONFIRMED"].includes(String(item.consultationStatus || "").toUpperCase());
}

function buildBoardRooms(rooms: Room[], appointments: BoardAppointment[]): BoardRoom[] {
  const physical = rooms
    .filter((room) => room.status !== "DELETED")
    .sort((a, b) =>
      `${a.centerName}-${a.name}`.localeCompare(`${b.centerName}-${b.name}`, "zh-CN"),
    )
    .map((room) => ({
      key: `${room.centerId}:${room.roomCode}`,
      databaseId: room.id,
      centerId: room.centerId,
      centerName: room.centerName,
      roomId: room.roomCode,
      roomName: room.name,
      status: room.status || "AVAILABLE",
    }));
  const result = [
    ...physical,
    {
      key: "video:video",
      databaseId: null,
      centerId: "video",
      centerName: "线上咨询",
      roomId: "video",
      roomName: "视频咨询",
      status: "AVAILABLE",
    },
  ];
  if (appointments.some((item) => !result.some((room) => room.key === appointmentRoomKey(item)))) {
    result.push({
      key: "unassigned:unassigned",
      databaseId: null,
      centerId: "unassigned",
      centerName: "其他",
      roomId: "unassigned",
      roomName: "未分配咨询室",
      status: "AVAILABLE",
    });
  }
  return result;
}

function appointmentRoomKey(item: BoardAppointment) {
  if (item.centerId === "video") return "video:video";
  if (!item.centerId || !item.roomId) return "unassigned:unassigned";
  return `${item.centerId}:${item.roomId}`;
}

function boardRoomToRoom(room: BoardRoom): Room {
  return {
    id: room.databaseId,
    centerId: room.centerId,
    centerName: room.centerName,
    roomCode: room.roomId,
    name: room.roomName,
    status: room.status,
  };
}

function appointmentOverlapsSlot(appointment: BoardAppointment, slotStart: number) {
  const appointmentStart = minutesOfDay(appointment.startTime);
  const appointmentEnd = minutesOfDay(appointment.endTime);
  return appointmentStart < slotStart + SLOT_MINUTES && appointmentEnd > slotStart;
}

function roomSlotStatus(dayStatus: RoomDayStatus | undefined, room: BoardRoom, slotStart: number) {
  if (room.centerId === "video" || room.centerId === "unassigned") return "AVAILABLE";
  const roomStatus = dayStatus?.rooms.find(
    (item) => item.centerId === room.centerId && item.roomCode === room.roomId,
  );
  return roomStatus?.slots.find((slot) => slot.timeSlot === formatMinutes(slotStart))?.status
    || room.status
    || "AVAILABLE";
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

function minutesFromSlotLabel(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function formatMinutes(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeText(value?: string | null) {
  return String(value || "").slice(11, 16) || "-";
}

