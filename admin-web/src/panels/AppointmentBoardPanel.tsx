"use client";

import { useMemo, useState, type CSSProperties } from "react";

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

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;
/** 每半小时一行的高度（像素）；预约块按起止时间换算纵向位置与高度。 */
const SLOT_HEIGHT = 78;
const BASE_COLUMN_WIDTH = 156;
const TIME_COLUMN_WIDTH = 136;
/** 预约块最小高度，保证短时段预约也能完整显示一行文字。 */
const MIN_BLOCK_HEIGHT = 30;
/** 低于该高度的预约块放不下「姓名 + 时间」两行，改为单行紧凑显示。 */
const COMPACT_BLOCK_HEIGHT = 50;
const PX_PER_MINUTE = SLOT_HEIGHT / SLOT_MINUTES;
const UNASSIGNED_ROOM_KEY = "unassigned:unassigned";
const CANCELLED_ROOM_KEY = "unassigned:cancelled";
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
  const [occupiedNoteModal, setOccupiedNoteModal] = useState<{
    roomName: string;
    timeSlot: string;
    note: string;
  } | null>(null);
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
          sourceRooms={rooms}
          appointments={appointments}
          roomDayStatus={roomDayStatus}
          onOpenAppointment={openAppointmentStatus}
          onOpenOccupied={(payload) => setOccupiedNoteModal(payload)}
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

      {occupiedNoteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--lxxl-text)]">占用备注</h3>
            <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
              {occupiedNoteModal.roomName} · {occupiedNoteModal.timeSlot}
            </p>
            <div className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-text)] whitespace-pre-wrap">
              {occupiedNoteModal.note || "（无备注）"}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white"
                onClick={() => setOccupiedNoteModal(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RoomBoard({
  date,
  rooms,
  sourceRooms,
  appointments,
  roomDayStatus,
  onOpenAppointment,
  onOpenOccupied,
  onOpenRoom,
}: {
  date: string;
  rooms: BoardRoom[];
  sourceRooms: Room[];
  appointments: BoardAppointment[];
  roomDayStatus?: RoomDayStatus;
  onOpenAppointment: (appointment: BoardAppointment) => void;
  onOpenOccupied: (payload: { roomName: string; timeSlot: string; note: string }) => void;
  onOpenRoom: (room: Room) => void;
}) {
  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const groups = useMemo(() => groupRooms(rooms), [rooms]);
  /**
   * 每一栏按日历方式排布预约：每条预约按真实起止时间定位、占满对应高度；
   * 时间重叠的预约并排显示，栏宽随最大并排数加宽，不再挤在半小时格子里被裁掉。
   */
  const columns = useMemo(
    () =>
      rooms.map((room) => {
        const roomAppointments = appointments.filter(
          (item) => appointmentRoomKey(item, sourceRooms) === room.key,
        );
        const { placed, laneCount } = layoutAppointments(roomAppointments);
        return { room, placed, width: BASE_COLUMN_WIDTH * Math.max(1, laneCount) };
      }),
    [appointments, rooms, sourceRooms],
  );
  const columnByKey = new Map(columns.map((column) => [column.room.key, column]));
  const roomWidths = columns.map((column) => column.width);
  const roomsWidth = roomWidths.reduce((sum, width) => sum + width, 0);
  const bodyHeight = timeSlots.length * SLOT_HEIGHT;
  const roomsGridTemplate = flexibleColumns(roomWidths);

  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--lxxl-border)] bg-white px-5 py-3">
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <div className="flex items-center gap-2 text-xs text-[var(--lxxl-muted)]" key={status}>
            <span className="h-3 w-7 rounded-full" style={{ background: meta.background }} />
            <span>{meta.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-[var(--lxxl-muted)]">
          <span className="h-3 w-7 rounded-full bg-[#E9D5FF]" />
          <span>占用（点击查看备注）</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--lxxl-muted)]">
          <span className="h-3 w-7 rounded-full bg-[#E5E0D8]" />
          <span>停用/不可用</span>
        </div>
        <div className="text-xs text-[var(--lxxl-muted)]">已取消的预约统一记录在「其他 · 已取消」栏</div>
      </div>
      <div className="max-h-[calc(100vh-190px)] overflow-auto">
        <div style={{ minWidth: TIME_COLUMN_WIDTH + roomsWidth }}>
          <div className="sticky top-0 z-30 flex border-b border-[var(--lxxl-border)] bg-[#FAF8F4] shadow-sm">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-center justify-center border-r border-[var(--lxxl-border)] bg-[#FAF8F4] px-3 py-4 text-center text-sm font-medium"
              style={{ width: TIME_COLUMN_WIDTH }}
            >
              <span>{date}</span>
            </div>
            <div className="flex min-w-0 flex-1">
              {groups.map((group) => {
                const groupWidths = group.rooms.map(
                  (room) => columnByKey.get(room.key)?.width || BASE_COLUMN_WIDTH,
                );
                const groupWidth = groupWidths.reduce((sum, width) => sum + width, 0);
                return (
                  <div
                    key={group.centerId}
                    className="border-r border-[var(--lxxl-border)]"
                    style={{ flex: `${groupWidth} ${groupWidth} ${groupWidth}px`, minWidth: groupWidth }}
                  >
                    <div className="border-b border-[var(--lxxl-border)] px-3 py-3 text-center text-sm font-semibold">
                      {group.centerName}
                    </div>
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: flexibleColumns(groupWidths) }}
                    >
                      {group.rooms.map((room) => (
                        <div
                          key={room.key}
                          className="border-r border-[var(--lxxl-border)] px-2 py-3 text-center text-sm last:border-r-0"
                        >
                          {room.key === CANCELLED_ROOM_KEY ? (
                            `${room.roomName}（${columnByKey.get(room.key)?.placed.length ?? 0}）`
                          ) : room.centerId === "video" || room.centerId === "unassigned" ? (
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
                );
              })}
            </div>
          </div>

          <div className="flex">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-[var(--lxxl-border)] bg-white"
              style={{ width: TIME_COLUMN_WIDTH, height: bodyHeight }}
            >
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="absolute inset-x-0 flex items-start justify-center border-b border-[var(--lxxl-border)] bg-white px-3 pt-3 text-center text-sm text-[var(--lxxl-muted)]"
                  style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                >
                  {slot}
                </div>
              ))}
            </div>
            <div
              className="grid min-w-0 flex-1"
              style={{
                gridTemplateColumns: roomsGridTemplate,
                minWidth: roomsWidth,
                height: bodyHeight,
              }}
            >
              {columns.map(({ room, placed }) => (
                <div
                  key={room.key}
                  className="relative border-r border-[var(--lxxl-border)]"
                >
                  {timeSlots.map((slot) => {
                    const slotStart = minutesFromSlotLabel(slot);
                    const hasAppointment = placed.some(
                      (item) => item.start < slotStart + SLOT_MINUTES && item.end > slotStart,
                    );
                    const slotMeta = roomSlotMeta(roomDayStatus, room, slotStart);
                    const unavailable = slotMeta.status !== "AVAILABLE";
                    const occupied = slotMeta.status === "OCCUPIED";
                    return (
                      <div
                        key={`${room.key}-${slot}`}
                        className={`flex flex-col justify-center overflow-hidden border-b border-[var(--lxxl-border)] px-1.5 py-1 ${
                          occupied
                            ? "bg-[#F3E8FF]"
                            : unavailable
                              ? "bg-[#F6F3EE]"
                              : ""
                        }`}
                        style={{ height: SLOT_HEIGHT }}
                      >
                        {hasAppointment ? null : occupied ? (
                          <button
                            type="button"
                            className="w-full truncate rounded-full bg-[#E9D5FF] px-2 py-1 text-center text-xs font-medium text-[#6B21A8] transition hover:brightness-95"
                            title={slotMeta.note ? `占用：${slotMeta.note}` : "占用"}
                            onClick={() =>
                              onOpenOccupied({
                                roomName: room.roomName,
                                timeSlot: slot,
                                note: slotMeta.note || "",
                              })
                            }
                          >
                            {slotMeta.note ? `占用：${slotMeta.note}` : "占用"}
                          </button>
                        ) : unavailable ? (
                          <div className="rounded-full bg-[#E5E0D8] px-2 py-1 text-center text-xs font-medium text-[#756F67]">
                            不可用
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {placed.map((item) => {
                    const height = blockHeight(item);
                    return (
                      <AppointmentBlock
                        key={`${item.appointment.scheduleId}-${item.appointment.consultationId ?? ""}`}
                        appointment={item.appointment}
                        compact={height < COMPACT_BLOCK_HEIGHT}
                        showOriginalPlace={room.key === CANCELLED_ROOM_KEY}
                        style={{
                          top: (item.start - START_MINUTES) * PX_PER_MINUTE + 2,
                          height,
                          left: `calc(${(item.lane / item.groupLanes) * 100}% + 3px)`,
                          width: `calc(${(item.span / item.groupLanes) * 100}% - 6px)`,
                        }}
                        onClick={() => onOpenAppointment(item.appointment)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentBlock({
  appointment,
  compact,
  showOriginalPlace,
  style,
  onClick,
}: {
  appointment: BoardAppointment;
  /** 预约块太矮时只显示一行：开始时间 + 咨询师 - 来访。 */
  compact: boolean;
  /** 「已取消」栏里额外标出原预约的咨询室/中心。 */
  showOriginalPlace: boolean;
  style: CSSProperties;
  onClick: () => void;
}) {
  const meta = STATUS_META[displayStatus(appointment)];
  const patient = formatPatientNameWithContractTag(
    appointment.patientName,
    appointment.patientContractTag,
  ) || "来访";
  const people = `${appointment.counselorName} - ${patient}`;
  const time = `${timeText(appointment.startTime)}-${timeText(appointment.endTime)}`;
  const place = showOriginalPlace ? appointmentPlaceLabel(appointment) : "";
  const title = [people, time, place ? `原预约：${place}` : ""].filter(Boolean).join("\n");

  return (
    <button
      type="button"
      className={`absolute z-10 flex flex-col overflow-hidden rounded-lg border border-black/5 px-2 text-left text-xs leading-5 shadow-sm transition hover:z-[15] hover:brightness-95 ${
        compact ? "justify-center" : "py-1"
      }`}
      style={{ ...style, background: meta.background, color: meta.color }}
      title={title}
      onClick={onClick}
    >
      {compact ? (
        <span className="truncate font-medium">
          {timeText(appointment.startTime)} {people}
        </span>
      ) : (
        <>
          <span className="line-clamp-2 shrink-0 break-words font-medium">{people}</span>
          <span className="truncate opacity-80">{time}</span>
          {place ? <span className="truncate opacity-80">原：{place}</span> : null}
        </>
      )}
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
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                {item.centerId === "video" && item.roomId
                  ? `${item.centerName || "视频咨询"}（线下室）`
                  : item.centerName || "-"}
              </td>
              <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                {item.roomName || (item.centerId === "video" ? "视频咨询" : "未分配")}
              </td>
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
  const activeAppointments = appointments.filter((item) => !isCancelledAppointment(item));
  if (activeAppointments.some((item) => !result.some((room) => room.key === appointmentRoomKey(item, rooms)))) {
    result.push({
      key: UNASSIGNED_ROOM_KEY,
      databaseId: null,
      centerId: "unassigned",
      centerName: "其他",
      roomId: "unassigned",
      roomName: "未分配咨询室",
      status: "AVAILABLE",
    });
  }
  // 已取消的预约不再占用原咨询室栏，统一记录在「其他 · 已取消」栏。
  result.push({
    key: CANCELLED_ROOM_KEY,
    databaseId: null,
    centerId: "unassigned",
    centerName: "其他",
    roomId: "cancelled",
    roomName: "已取消",
    status: "AVAILABLE",
  });
  return result;
}

/** 由咨询室 code 解析线下中心（视频咨询占用线下室时用）。 */
function physicalCenterIdForRoom(roomId: string, rooms: Room[]): string | null {
  const matched = rooms.find(
    (room) => room.roomCode === roomId && room.centerId !== "video" && room.centerId !== "unassigned",
  );
  if (matched?.centerId) return matched.centerId;
  const prefix = roomId.split("-")[0]?.trim();
  if (prefix && prefix !== "video" && prefix !== "unassigned") return prefix;
  return null;
}

/**
 * 看板列归属：
 * - 视频咨询且未选线下室 → 线上「视频咨询」列
 * - 视频咨询且已选/已占线下室 → 对应线下咨询室列
 * - 线下预约 → 对应中心咨询室列
 * - 已取消 → 「其他 · 已取消」列
 */
function appointmentRoomKey(item: BoardAppointment, rooms: Room[] = []) {
  if (isCancelledAppointment(item)) return CANCELLED_ROOM_KEY;
  if (item.centerId === "video") {
    if (!item.roomId) return "video:video";
    const physicalCenter = physicalCenterIdForRoom(item.roomId, rooms);
    if (physicalCenter) return `${physicalCenter}:${item.roomId}`;
    return UNASSIGNED_ROOM_KEY;
  }
  if (!item.centerId || !item.roomId) return UNASSIGNED_ROOM_KEY;
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

type PlacedAppointment = {
  appointment: BoardAppointment;
  /** 看板上的起止分钟（已截取到看板时间范围内）。 */
  start: number;
  end: number;
  /** 按最小高度换算后实际占到的结束分钟，用于判断视觉上是否重叠。 */
  visualEnd: number;
  /** 所在重叠组内的起始泳道、横跨泳道数与该组泳道总数。 */
  lane: number;
  span: number;
  groupLanes: number;
};

/**
 * 日历式排布：时间上（含传递）重叠的预约归为一组，组内按开始时间贪心分配泳道并排显示；
 * 宽度按所在组的泳道数均分，右侧泳道空闲时向右延展，不与他人重叠的预约独占整栏。
 */
function layoutAppointments(items: BoardAppointment[]): {
  placed: PlacedAppointment[];
  laneCount: number;
} {
  const placed: PlacedAppointment[] = items
    .map((appointment) => {
      const { start, end } = appointmentRange(appointment);
      const visualEnd = Math.max(end, start + (MIN_BLOCK_HEIGHT + 4) / PX_PER_MINUTE);
      return { appointment, start, end, visualEnd, lane: 0, span: 1, groupLanes: 1 };
    })
    .sort((a, b) => a.start - b.start || b.visualEnd - a.visualEnd);

  let laneCount = 0;
  let group: PlacedAppointment[] = [];
  let groupEnd = -Infinity;
  const settleGroup = () => {
    const laneEnds: number[] = [];
    for (const item of group) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.visualEnd);
      } else {
        laneEnds[lane] = item.visualEnd;
      }
      item.lane = lane;
    }
    for (const item of group) {
      item.groupLanes = laneEnds.length;
      let span = 1;
      while (
        item.lane + span < laneEnds.length
        && !group.some(
          (other) =>
            other.lane === item.lane + span
            && other.start < item.visualEnd
            && other.visualEnd > item.start,
        )
      ) {
        span += 1;
      }
      item.span = span;
    }
    laneCount = Math.max(laneCount, laneEnds.length);
    group = [];
  };
  for (const item of placed) {
    if (group.length > 0 && item.start >= groupEnd) settleGroup();
    group.push(item);
    groupEnd = group.length === 1 ? item.visualEnd : Math.max(groupEnd, item.visualEnd);
  }
  if (group.length > 0) settleGroup();
  return { placed, laneCount };
}

function appointmentRange(appointment: BoardAppointment) {
  const start = clampBoardMinutes(minutesOfDay(appointment.startTime));
  let end = clampBoardMinutes(minutesOfDay(appointment.endTime));
  if (end <= start) {
    // 跨零点结束的截到看板末尾；其他异常数据至少显示半小时。
    end = String(appointment.endTime || "").slice(0, 10) > String(appointment.startTime || "").slice(0, 10)
      ? END_MINUTES
      : Math.min(start + SLOT_MINUTES, END_MINUTES);
  }
  return { start, end };
}

function blockHeight(item: PlacedAppointment) {
  return Math.max((item.end - item.start) * PX_PER_MINUTE - 4, MIN_BLOCK_HEIGHT);
}

function clampBoardMinutes(value: number) {
  return Math.min(Math.max(value, START_MINUTES), END_MINUTES);
}

function isCancelledAppointment(item: BoardAppointment) {
  return displayStatus(item) === "CANCELLED";
}

/** 已取消栏里展示的原预约位置。 */
function appointmentPlaceLabel(item: BoardAppointment) {
  if (item.roomName) return item.roomName;
  if (item.centerId === "video") return "视频咨询";
  return item.centerName || "";
}

function roomSlotMeta(
  dayStatus: RoomDayStatus | undefined,
  room: BoardRoom,
  slotStart: number,
): { status: string; note: string } {
  if (room.centerId === "video" || room.centerId === "unassigned") {
    return { status: "AVAILABLE", note: "" };
  }
  const roomStatus = dayStatus?.rooms.find(
    (item) => item.centerId === room.centerId && item.roomCode === room.roomId,
  );
  const slot = roomStatus?.slots.find((item) => item.timeSlot === formatMinutes(slotStart));
  return {
    status: slot?.status || room.status || "AVAILABLE",
    note: slot?.note || "",
  };
}

/** 列宽不小于基础宽度；屏幕更宽时按基础宽度比例拉伸，铺满看板。 */
function flexibleColumns(widths: number[]) {
  return widths.map((width) => `minmax(${width}px, ${width}fr)`).join(" ");
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

