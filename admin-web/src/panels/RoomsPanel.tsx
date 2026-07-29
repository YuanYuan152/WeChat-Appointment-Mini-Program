import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  Badge,
  CollapsibleSection,
  EmptyState,
  MiniStat,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import { getLocalDateValue } from "@/lib/date";
import { formatDateTime, statusLabel } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import { getPageItems } from "@/lib/pagination";
import type {
  Room,
  RoomDetail,
  RoomDetailSlot,
  RoomSlotManualStatus,
  RoomStatus,
  RoomStatusSnapshot,
  ScheduleRoomOptions,
} from "@/types/api";
import type { RoomFilters } from "@/types/app";

const FIXED_TIME_SLOTS = [9, 10, 11, 13, 14, 15, 16, 17, 18].flatMap((hour) =>
  [0, 30].map(
    (minute) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  ),
);
type RoomEditableStatus = Exclude<RoomSlotManualStatus, "MAINTENANCE">;
const ROOM_STATUS_OPTIONS: RoomEditableStatus[] = ["AVAILABLE", "DISABLED"];

export function RoomsPanel({
  rooms,
  roomStatus,
  listLoading,
  detailLoading,
  actionLoading,
  selectedRoom,
  selectedSnapshot,
  roomOptions,
  filters,
  setFilters,
  page,
  pageSize,
  onSearch,
  onReset,
  onOpenRoom,
  onCloseDetail,
  onSaveRoom,
  onSaveSlotStatuses,
  onAddRoom,
  onChangeScheduleRoom,
  onPageChange,
  onPageSizeChange,
}: {
  rooms?: Room[];
  roomStatus?: RoomStatusSnapshot;
  listLoading: boolean;
  detailLoading: boolean;
  actionLoading: boolean;
  selectedRoom?: RoomDetail;
  selectedSnapshot?: RoomStatus;
  roomOptions?: ScheduleRoomOptions;
  filters: RoomFilters;
  setFilters: Dispatch<SetStateAction<RoomFilters>>;
  page: number;
  pageSize: number;
  onSearch: () => void;
  onReset: () => void;
  onOpenRoom: (room: Room, snapshot?: RoomStatus) => void;
  onCloseDetail: () => void;
  onSaveRoom: (roomId: number, input: { name: string; status: string }) => Promise<void>;
  onSaveSlotStatuses: (
    roomId: number,
    slots: Array<{ startTime: string; status: RoomSlotManualStatus }>,
  ) => Promise<void>;
  onAddRoom: (input: { centerId: string; name: string; roomCode?: string; status: string }) => Promise<boolean>;
  onChangeScheduleRoom: (scheduleId: number, roomCode: string) => Promise<void>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const statusMap = new Map((roomStatus?.rooms || []).map((room) => [`${room.centerId}-${room.roomCode}`, room]));
  const allRooms = rooms || [];
  const { currentPage, items } = getPageItems(allRooms, page, pageSize);
  const snapshotText = `${roomStatus?.date || filters.date || getLocalDateValue()}${
    roomStatus?.timeSlot || filters.timeSlot ? ` ${roomStatus?.timeSlot || filters.timeSlot}` : ""
  }`;

  return (
    <>
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">咨询室情况</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                快照：{snapshotText}。支持按预约中心、日期和半小时时段查询。
              </p>
            </div>
            <button
              className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]"
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              新增咨询室
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="预约中心">
              <select
                className={queryControlClass}
                value={filters.centerId}
                onChange={(event) => setFilters((prev) => ({ ...prev, centerId: event.target.value }))}
              >
                <option value="">全部中心</option>
                <option value="yangpu">杨浦预约中心</option>
                <option value="pudong">浦东预约中心</option>
              </select>
            </QueryField>

            <QueryField label="日期">
              <input
                className={queryControlClass}
                type="date"
                value={filters.date}
                onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
              />
            </QueryField>

            <QueryField label="时段">
              <select
                className={queryControlClass}
                value={filters.timeSlot}
                onChange={(event) => setFilters((prev) => ({ ...prev, timeSlot: event.target.value }))}
              >
                <option value="">默认时段</option>
                {FIXED_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </select>
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="relative">
          {listLoading && allRooms.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载列表...
            </div>
          )}
          {allRooms.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载列表..." : "暂无咨询室数据。"} />
          ) : (
            <>
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">预约中心</th>
                    <th className="px-5 py-3 font-medium">咨询室</th>
                    <th className="px-5 py-3 font-medium">咨询室状态</th>
                    <th className="px-5 py-3 font-medium">时段状态</th>
                    <th className="px-5 py-3 font-medium">咨询师</th>
                    <th className="px-5 py-3 font-medium">来访者</th>
                    <th className="px-5 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((room) => {
                    const snapshot = statusMap.get(`${room.centerId}-${room.roomCode}`);
                    return (
                      <tr key={`${room.centerId}-${room.roomCode}`} className="border-t border-[var(--lxxl-border)]">
                        <td className="px-5 py-4">{room.centerName}</td>
                        <td className="px-5 py-4">
                          <div className="font-medium">{room.name}</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{room.roomCode}</div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={roomStatusTone(room.status)}>{roomStatusLabel(room.status)}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={snapshot?.occupancy === "IN_SESSION" ? "gold" : "green"}>
                            {roomStatusLabel(snapshot?.occupancy)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div>{snapshot?.counselorName || "-"}</div>
                          {snapshot?.counselorMobile && (
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{snapshot.counselorMobile}</div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div>{snapshot?.patientName || "-"}</div>
                          {snapshot?.patientMobile && (
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{snapshot.patientMobile}</div>
                          )}
                          {snapshot?.patientContractTag && (
                            <div className="mt-1 text-xs font-medium text-[#315D4B]">{snapshot.patientContractTag}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <TableActionButton onClick={() => onOpenRoom(room, snapshot)}>查看</TableActionButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                total={allRooms.length}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          )}
        </div>
      </section>

      {(detailLoading || selectedRoom) && (
        <DetailDrawer title="咨询室详情" onClose={onCloseDetail}>
          {detailLoading && !selectedRoom ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
          ) : selectedRoom ? (
            <RoomDetailPanel
              actionLoading={actionLoading}
              room={selectedRoom}
              roomOptions={roomOptions}
              snapshot={selectedSnapshot}
              onChangeScheduleRoom={onChangeScheduleRoom}
              onSaveRoom={onSaveRoom}
              onSaveSlotStatuses={onSaveSlotStatuses}
            />
          ) : null}
        </DetailDrawer>
      )}

      {createOpen && (
        <CreateRoomModal
          actionLoading={actionLoading}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            const ok = await onAddRoom(input);
            if (ok) {
              setCreateOpen(false);
            }
          }}
        />
      )}
    </>
  );
}

function RoomDetailPanel({
  room,
  snapshot,
  roomOptions,
  actionLoading,
  onSaveRoom,
  onSaveSlotStatuses,
  onChangeScheduleRoom,
}: {
  room: RoomDetail;
  snapshot?: RoomStatus;
  roomOptions?: ScheduleRoomOptions;
  actionLoading: boolean;
  onSaveRoom: (roomId: number, input: { name: string; status: string }) => Promise<void>;
  onSaveSlotStatuses: (
    roomId: number,
    slots: Array<{ startTime: string; status: RoomSlotManualStatus }>,
  ) => Promise<void>;
  onChangeScheduleRoom: (scheduleId: number, roomCode: string) => Promise<void>;
}) {
  const activeSnapshot = snapshot || room.current;
  const scheduleId = activeSnapshot?.scheduleId || room.current?.scheduleId;
  const [name, setName] = useState(room.name);
  const [status, setStatus] = useState<RoomEditableStatus>(() => normalizeEditableRoomStatus(room.status));
  const [targetRoomCode, setTargetRoomCode] = useState("");
  const [slotStatusDrafts, setSlotStatusDrafts] = useState<Record<string, RoomEditableStatus>>({});

  useEffect(() => {
    setName(room.name);
    setStatus(normalizeEditableRoomStatus(room.status));
  }, [room.id, room.name, room.status]);

  useEffect(() => {
    const nextRoom = roomOptions?.options.find((option) => !option.isCurrent)?.roomCode || "";
    setTargetRoomCode(nextRoom);
  }, [roomOptions]);

  useEffect(() => {
    const next: Record<string, RoomEditableStatus> = {};
    for (const day of room.days) {
      for (const slot of day.slots) {
        if (slot.startTime) {
          next[slot.startTime] = normalizeSlotStatus(slot.manualStatus);
        }
      }
    }
    setSlotStatusDrafts(next);
  }, [room.id, room.days]);

  const changedSlots = room.days.flatMap((day) =>
    day.slots
      .filter((slot) => slot.startTime && slot.editable)
      .map((slot) => ({
        startTime: slot.startTime as string,
        original: normalizeSlotStatus(slot.manualStatus),
        status: slotStatusDrafts[slot.startTime as string] || normalizeSlotStatus(slot.manualStatus),
      }))
      .filter((slot) => slot.status !== slot.original)
      .map(({ startTime, status: nextStatus }) => ({ startTime, status: nextStatus })),
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-[var(--lxxl-muted)]">咨询室详情</div>
        <h3 className="mt-2 text-lg font-semibold">{room.name}</h3>
        <div className="mt-1 text-sm text-[var(--lxxl-muted)]">
          {room.centerName} · {room.roomCode}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="咨询室状态" value={roomStatusLabel(room.status)} />
        <MiniStat label="当前时段" value={roomStatusLabel(activeSnapshot?.occupancy)} />
        <MiniStat label="咨询师" value={activeSnapshot?.counselorName || "-"} />
        <MiniStat
          label="来访者"
          value={[activeSnapshot?.patientName, activeSnapshot?.patientContractTag].filter(Boolean).join(" ") || "-"}
        />
      </div>

      <CollapsibleSection title="联系方式">
        <div className="mt-3 grid gap-2 text-sm text-[var(--lxxl-muted)]">
          <div>咨询师：{activeSnapshot?.counselorName || "-"} {activeSnapshot?.counselorMobile || ""}</div>
          <div>
            来访者：
            {formatPatientNameWithContractTag(activeSnapshot?.patientName, activeSnapshot?.patientContractTag) || "-"}{" "}
            {activeSnapshot?.patientMobile || ""}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="编辑咨询室">
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <QueryField label="咨询室名称">
            <input className={queryControlClass} value={name} onChange={(event) => setName(event.target.value)} />
          </QueryField>
          <QueryField label="状态">
            <select
              className={queryControlClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as RoomEditableStatus)}
            >
              {ROOM_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {roomStatusLabel(item)}
                </option>
              ))}
            </select>
          </QueryField>
        </div>
        <button
          className="mt-4 h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-50"
          type="button"
          disabled={actionLoading || !room.id || !name.trim()}
          onClick={() => room.id && onSaveRoom(room.id, { name: name.trim(), status })}
        >
          保存
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="调换咨询室">
        {scheduleId ? (
          <div className="mt-3 space-y-3">
            <div className="text-sm text-[var(--lxxl-muted)]">
              当前预约：{formatDateTime(activeSnapshot?.startTime)} 至{" "}
              {formatDateTime(activeSnapshot?.endTime)}
            </div>
            <select
              className={queryControlClass}
              value={targetRoomCode}
              onChange={(event) => setTargetRoomCode(event.target.value)}
            >
              <option value="">选择可调换咨询室</option>
              {(roomOptions?.options || []).map((option) => (
                <option key={option.roomCode} value={option.roomCode} disabled={option.isCurrent}>
                  {option.name}{option.isCurrent ? "（当前）" : ""}
                </option>
              ))}
            </select>
            <button
              className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-50"
              type="button"
              disabled={actionLoading || !targetRoomCode}
              onClick={() => onChangeScheduleRoom(scheduleId, targetRoomCode)}
            >
              确认调换
            </button>
          </div>
        ) : (
          <div className="mt-3 text-sm text-[var(--lxxl-muted)]">当前时段没有已预约咨询，无需调换。</div>
        )}
      </CollapsibleSection>

      <CollapsibleSection count={room.days.reduce((total, day) => total + day.slots.length, 0)} title="未来时段">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">未来时段</h4>
            <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
              以半小时为单位维护可用/停用状态；一次预约占用“50 分钟咨询 + 10 分钟打扫”对应的两个半小时时段。
            </p>
          </div>
          <button
            className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-50"
            type="button"
            disabled={actionLoading || !room.id || changedSlots.length === 0}
            onClick={() => room.id && onSaveSlotStatuses(room.id, changedSlots)}
          >
            保存时段状态
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {room.days.map((day) => (
            <div key={day.date} className="rounded-xl border border-[var(--lxxl-border)]">
              <div className="border-b border-[var(--lxxl-border)] px-4 py-3 text-sm font-medium">{day.date}</div>
              <div className="divide-y divide-[var(--lxxl-border)]">
                {day.slots.map((slot) => {
                  const draftStatus = slot.startTime
                    ? slotStatusDrafts[slot.startTime] || normalizeSlotStatus(slot.manualStatus)
                    : normalizeSlotStatus(slot.manualStatus);
                  return (
                    <RoomSlotRow
                      key={`${day.date}-${slot.key}`}
                      actionLoading={actionLoading}
                      draftStatus={draftStatus}
                      onChange={(nextStatus) => {
                        if (!slot.startTime) {
                          return;
                        }
                        setSlotStatusDrafts((prev) => ({ ...prev, [slot.startTime as string]: nextStatus }));
                      }}
                      slot={slot}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function RoomSlotRow({
  slot,
  draftStatus,
  actionLoading,
  onChange,
}: {
  slot: RoomDetailSlot;
  draftStatus: RoomEditableStatus;
  actionLoading: boolean;
  onChange: (status: RoomEditableStatus) => void;
}) {
  const locked = !slot.editable || slot.occupancy === "IN_SESSION";
  const statusTone = slot.occupancy === "IN_SESSION" ? "gold" : slot.occupancy === "IDLE" ? "green" : "neutral";
  const displayStatus =
    !slot.occupancy || slot.occupancy === "IDLE" ? roomStatusLabel(draftStatus) : roomStatusLabel(slot.occupancy);

  return (
    <div className="grid gap-3 px-4 py-3 text-xs sm:grid-cols-[120px_1fr_150px] sm:items-center">
      <div>
        {slot.patientName && (
          <div className="mb-1 font-medium text-[#315D4B]">来访：{slot.patientName}</div>
        )}
        <div className="font-medium text-[var(--lxxl-text)]">{slot.timeLabel}</div>
        <div className="mt-1 text-[var(--lxxl-muted)]">{slot.past ? "已过时段" : locked ? "不可调整" : "可调整"}</div>
      </div>
      <div className="space-y-2 text-[var(--lxxl-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>{displayStatus}</Badge>
          {slot.scheduleId ? <span>当前有预约</span> : <span>暂无预约</span>}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <div>
            咨询师：{slot.counselorName || "-"}
            {slot.counselorMobile ? `（${slot.counselorMobile}）` : ""}
          </div>
          <div>
            来访者：{slot.patientName || "-"}
            {slot.patientMobile ? `（${slot.patientMobile}）` : ""}
            {slot.patientContractTag ? ` ${slot.patientContractTag}` : ""}
          </div>
        </div>
      </div>
      <select
        className={`${queryControlClass} h-9`}
        disabled={actionLoading || locked}
        value={draftStatus}
        onChange={(event) => onChange(event.target.value as RoomEditableStatus)}
      >
        {ROOM_STATUS_OPTIONS.map((item) => (
          <option key={item} value={item}>
            {roomStatusLabel(item)}
          </option>
        ))}
      </select>
    </div>
  );
}

function normalizeSlotStatus(status?: string | null): RoomEditableStatus {
  return normalizeEditableRoomStatus(status);
}

function normalizeEditableRoomStatus(status?: string | null): RoomEditableStatus {
  return status === "DISABLED" || status === "MAINTENANCE" ? "DISABLED" : "AVAILABLE";
}

function roomStatusLabel(status?: string | null) {
  if (status === "BOOKED" || status === "IN_SESSION") {
    return "已预约";
  }
  if (status === "DISABLED" || status === "MAINTENANCE") {
    return "停用";
  }
  if (status === "AVAILABLE" || status === "IDLE") {
    return "可用";
  }
  return statusLabel(status);
}

function roomStatusTone(status?: string | null) {
  if (status === "BOOKED" || status === "IN_SESSION") {
    return "gold";
  }
  if (status === "AVAILABLE" || status === "IDLE") {
    return "green";
  }
  return "neutral";
}

function CreateRoomModal({
  actionLoading,
  onClose,
  onSubmit,
}: {
  actionLoading: boolean;
  onClose: () => void;
  onSubmit: (input: { centerId: string; name: string; roomCode?: string; status: string }) => Promise<void>;
}) {
  const [centerId, setCenterId] = useState("yangpu");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState<RoomEditableStatus>("AVAILABLE");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6">
      <form
        className="w-full max-w-lg rounded-2xl border border-[var(--lxxl-border)] bg-white p-6 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ centerId, name: name.trim(), roomCode: roomCode.trim() || undefined, status });
        }}
      >
        <h3 className="text-lg font-semibold">新增咨询室</h3>
        <div className="mt-5 grid gap-4">
          <QueryField label="预约中心">
            <select className={queryControlClass} value={centerId} onChange={(event) => setCenterId(event.target.value)}>
              <option value="yangpu">杨浦预约中心</option>
              <option value="pudong">浦东预约中心</option>
            </select>
          </QueryField>
          <QueryField label="咨询室名称">
            <input className={queryControlClass} placeholder="例如：咨询室 D" value={name} onChange={(event) => setName(event.target.value)} />
          </QueryField>
          <QueryField label="咨询室代码">
            <input className={queryControlClass} placeholder="可不填，系统自动生成" value={roomCode} onChange={(event) => setRoomCode(event.target.value)} />
          </QueryField>
          <QueryField label="初始状态">
            <select
              className={queryControlClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as RoomEditableStatus)}
            >
              {ROOM_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {roomStatusLabel(item)}
                </option>
              ))}
            </select>
          </QueryField>
        </div>
        <div className="mt-6 flex justify-start gap-3">
          <button
            className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={actionLoading || !name.trim()}
          >
            新增
          </button>
          <button
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)]"
            type="button"
            disabled={actionLoading}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

function slotLabel(slot: string) {
  const [hourText, minuteText] = slot.split(":");
  const start = Number(hourText) * 60 + Number(minuteText);
  if (!Number.isFinite(start)) {
    return slot;
  }
  const end = start + 30;
  return `${slot}-${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
