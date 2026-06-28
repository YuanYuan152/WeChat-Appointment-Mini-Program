import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { formatDateTime, statusLabel } from "@/lib/format";
import type {
  CounselorScheduleCalendar,
  CounselorScheduleCalendarItem,
  CounselorSlotOption,
  CounselorSlotOptions,
} from "@/types/api";

import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

export const COUNSELOR_CENTER_OPTIONS = [
  { value: "yangpu", label: "杨浦预约中心" },
  { value: "pudong", label: "浦东预约中心" },
  { value: "video", label: "视频咨询" },
];

export interface CounselorScheduleQuery {
  start: string;
  days: number;
}

export interface CounselorScheduleDraft {
  date: string;
  centerId: string;
  slotKey: string;
  roomId: string;
}

export function CounselorSchedulesPanel({
  calendar,
  slotOptions,
  listLoading,
  slotLoading,
  query,
  draft,
  page,
  pageSize,
  setQuery,
  setDraft,
  onSearch,
  onReset,
  onLoadSlots,
  onCreate,
  onCancel,
  onLeave,
  onPageChange,
  onPageSizeChange,
}: {
  calendar?: CounselorScheduleCalendar;
  slotOptions?: CounselorSlotOptions;
  listLoading: boolean;
  slotLoading: boolean;
  query: CounselorScheduleQuery;
  draft: CounselorScheduleDraft;
  page: number;
  pageSize: number;
  setQuery: Dispatch<SetStateAction<CounselorScheduleQuery>>;
  setDraft: Dispatch<SetStateAction<CounselorScheduleDraft>>;
  onSearch: () => void;
  onReset: () => void;
  onLoadSlots: () => void;
  onCreate: (slot: CounselorSlotOption, roomId: string) => void;
  onCancel: (scheduleId: number, reason?: string) => void;
  onLeave: (scheduleId: number, reason: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [pendingAction, setPendingAction] = useState<
    | { type: "cancel"; schedule: CounselorScheduleCalendarItem }
    | { type: "leave"; schedule: CounselorScheduleCalendarItem }
    | null
  >(null);
  const [reason, setReason] = useState("");
  const selectedSlot = slotOptions?.slots.find((slot) => slot.key === draft.slotKey);
  const availableRooms = selectedSlot?.rooms.filter((room) => room.available && !room.occupiedByOther) || [];
  const rows = calendar?.slots || [];
  const total = rows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  const confirmPendingAction = () => {
    if (!pendingAction) {
      return;
    }
    if (pendingAction.type === "leave") {
      onLeave(pendingAction.schedule.id, reason);
    } else {
      onCancel(pendingAction.schedule.id, reason || undefined);
    }
    setPendingAction(null);
    setReason("");
  };

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
          <div>
            <h2 className="text-xl font-semibold tracking-normal">我的排期</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              查看自己的排期，新增可预约时段；已预约咨询可按规则取消或提交请假申请。
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="开始日期">
              <input
                className={queryControlClass}
                type="date"
                value={query.start}
                onChange={(event) => setQuery((prev) => ({ ...prev, start: event.target.value }))}
              />
            </QueryField>
            <QueryField label="天数">
              <select
                className={queryControlClass}
                value={query.days}
                onChange={(event) => setQuery((prev) => ({ ...prev, days: Number(event.target.value) }))}
              >
                <option value={7}>7 天</option>
                <option value={14}>14 天</option>
                <option value={30}>30 天</option>
              </select>
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
          <div className="flex flex-wrap items-end gap-4">
            <QueryField label="新增日期" className="w-full sm:w-56">
              <input
                className={queryControlClass}
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, date: event.target.value, slotKey: "", roomId: "" }))
                }
              />
            </QueryField>
            <QueryField label="预约中心" className="w-full sm:w-56">
              <select
                className={queryControlClass}
                value={draft.centerId}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, centerId: event.target.value, slotKey: "", roomId: "" }))
                }
              >
                {COUNSELOR_CENTER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </QueryField>
            <QueryButton onClick={onLoadSlots}>{slotLoading ? "加载中" : "读取时段"}</QueryButton>
          </div>

          {slotOptions && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <QueryField label="时段">
                <select
                  className={queryControlClass}
                  value={draft.slotKey}
                  onChange={(event) => setDraft((prev) => ({ ...prev, slotKey: event.target.value, roomId: "" }))}
                >
                  <option value="">请选择时段</option>
                  {slotOptions.slots.map((slot) => (
                    <option
                      key={slot.key}
                      disabled={slot.past || slot.counselorOccupied || slot.allRoomsFull}
                      value={slot.key}
                    >
                      {slot.label}
                      {slot.past ? "（已过期）" : slot.counselorOccupied ? "（已有排期）" : slot.allRoomsFull ? "（已约满）" : ""}
                    </option>
                  ))}
                </select>
              </QueryField>
              {draft.centerId !== "video" && (
                <QueryField label="咨询室">
                  <select
                    className={queryControlClass}
                    value={draft.roomId}
                    onChange={(event) => setDraft((prev) => ({ ...prev, roomId: event.target.value }))}
                  >
                    <option value="">无偏好</option>
                    {availableRooms.map((room) => (
                      <option key={room.roomId} value={room.roomId}>
                        {room.roomName}
                      </option>
                    ))}
                  </select>
                </QueryField>
              )}
              <div className="flex items-end">
                <QueryButton
                  disabled={!selectedSlot || selectedSlot.past || selectedSlot.counselorOccupied || selectedSlot.allRoomsFull}
                  onClick={() => {
                    if (selectedSlot) {
                      onCreate(selectedSlot, draft.roomId);
                    }
                  }}
                >
                  新增
                </QueryButton>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          {listLoading && rows.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载排期...
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载排期..." : "暂无排期。"} />
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">时间</th>
                    <th className="px-5 py-3 font-medium">预约中心</th>
                    <th className="px-5 py-3 font-medium">咨询室</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">来访者</th>
                    <th className="px-5 py-3 font-medium">咨询记录</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                      <td className="px-5 py-4">
                        {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)}
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.centerName || "-"}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.roomName || "-"}</td>
                      <td className="px-5 py-4">
                        <Badge tone={item.status === "AVAILABLE" ? "green" : item.status === "BOOKED" ? "gold" : "neutral"}>
                          {item.displayStatus || statusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.patientName || "-"}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.hasCaseRecord ? "已填写" : "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          {item.requiresLeave && (
                            <TableActionButton
                              onClick={() => {
                                setPendingAction({ type: "leave", schedule: item });
                                setReason(item.leaveReason || "");
                              }}
                            >
                              请假
                            </TableActionButton>
                          )}
                          {item.canCancel && !item.requiresLeave && (
                            <TableActionButton
                              tone="danger"
                              onClick={() => {
                                setPendingAction({ type: "cancel", schedule: item });
                                setReason("");
                              }}
                            >
                              取消排期
                            </TableActionButton>
                          )}
                          {!item.canCancel && !item.requiresLeave && (
                            <span className="text-[var(--lxxl-muted)]">{item.cancelHint || "-"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          )}
        </div>
      </section>

      {pendingAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6">
          <section className="w-full max-w-lg rounded-xl border border-[var(--lxxl-border)] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {pendingAction.type === "leave" ? "提交请假申请" : "取消排期"}
            </h3>
            <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
              {formatDateTime(pendingAction.schedule.startTime)} 至 {formatDateTime(pendingAction.schedule.endTime)}
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">
                {pendingAction.type === "leave" ? "请假原因" : "取消原因"}
              </span>
              <textarea
                className={`${queryControlClass} h-28 resize-none py-3`}
                placeholder="请输入原因"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <QueryResetButton
                onClick={() => {
                  setPendingAction(null);
                  setReason("");
                }}
              >
                关闭
              </QueryResetButton>
              <QueryButton disabled={pendingAction.type === "leave" && !reason.trim()} onClick={confirmPendingAction}>
                确认
              </QueryButton>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
