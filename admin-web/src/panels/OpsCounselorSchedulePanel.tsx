import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  EmptyState,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import { getLocalDateValue, getRollingScheduleMaxDateValue } from "@/lib/date";
import { formatDateTime, statusLabel } from "@/lib/format";
import type {
  CounselorScheduleCalendar,
  CounselorScheduleCalendarItem,
  ScheduleRescheduleOptions,
  ScheduleRescheduleSlot,
} from "@/types/api";

export function OpsCounselorSchedulePanel({
  counselorName,
  calendar,
  month,
  selectedDate,
  loading,
  onMonthChange,
  onDateChange,
  onBack,
  onLoadRescheduleOptions,
  onReschedule,
}: {
  counselorName: string;
  calendar?: CounselorScheduleCalendar;
  month: string;
  selectedDate: string;
  loading: boolean;
  onMonthChange: (month: string) => void;
  onDateChange: (date: string) => void;
  onBack: () => void;
  onLoadRescheduleOptions: (scheduleId: number, date: string) => Promise<ScheduleRescheduleOptions>;
  onReschedule: (
    scheduleId: number,
    input: { startTime: string; endTime: string; roomId?: string; reason: string },
  ) => Promise<boolean>;
}) {
  const [rescheduleItem, setRescheduleItem] = useState<CounselorScheduleCalendarItem>();
  const cells = useMemo(() => calendarCells(month, calendar?.slots || []), [calendar?.slots, month]);
  const selectedRows = useMemo(
    () =>
      (calendar?.slots || [])
        .filter((item) => item.startTime.slice(0, 10) === selectedDate && item.displayStatus !== "CANCELLED")
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [calendar?.slots, selectedDate],
  );

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--lxxl-border)] px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold">{counselName(counselorName)}排期日历</h2>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">点击日期查看排期；未来已预约排期可修改时间。</p>
        </div>
        <QueryResetButton onClick={onBack}>返回排期总览</QueryResetButton>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div>
          <QueryField label="月份">
            <input className={queryControlClass} type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
          </QueryField>
          <div className="mt-5 grid grid-cols-7 text-center text-xs text-[var(--lxxl-muted)]">
            {"一二三四五六日".split("").map((day) => <div className="py-2" key={day}>{day}</div>)}
            {cells.map((cell, index) => (
              cell.empty ? <div key={`empty-${index}`} /> : (
                <button
                  key={cell.date}
                  className={`min-h-20 rounded-lg border p-2 text-left ${
                    selectedDate === cell.date
                      ? "border-[var(--lxxl-green)] bg-[#F4FBF7]"
                      : "border-[var(--lxxl-border)] hover:border-[var(--lxxl-green)]"
                  }`}
                  type="button"
                  onClick={() => onDateChange(cell.date)}
                >
                  <span className="text-sm font-medium">{cell.day}</span>
                  <span className="mt-2 block text-xs text-[var(--lxxl-muted)]">{cell.count ? `${cell.count} 节` : ""}</span>
                </button>
              )
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">{selectedDate} 排期</h3>
          <div className="mt-4 space-y-3">
            {loading ? <EmptyState text="正在加载排期..." /> : selectedRows.length ? selectedRows.map((item) => (
              <article className="rounded-xl border border-[var(--lxxl-border)] p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{formatDateTime(item.startTime)} - {formatDateTime(item.endTime)}</div>
                    <div className="mt-2 text-sm text-[var(--lxxl-muted)]">
                      {item.patientName || "开放排期"} · {item.centerName || "未指定中心"}
                      {item.roomName ? ` · ${item.roomName}` : ""}
                    </div>
                  </div>
                  <Badge tone={item.displayStatus === "BOOKED" ? "green" : "neutral"}>
                    {item.displayLabel || statusLabel(item.displayStatus)}
                  </Badge>
                </div>
                {canReschedule(item) && (
                  <div className="mt-4 flex justify-end">
                    <TableActionButton onClick={() => setRescheduleItem(item)}>改时间</TableActionButton>
                  </div>
                )}
              </article>
            )) : <EmptyState text="本日暂无排期" />}
          </div>
        </div>
      </div>

      {rescheduleItem && (
        <RescheduleModal
          item={rescheduleItem}
          onClose={() => setRescheduleItem(undefined)}
          onLoadOptions={onLoadRescheduleOptions}
          onSubmit={async (input) => {
            const ok = await onReschedule(rescheduleItem.id, input);
            if (ok) setRescheduleItem(undefined);
          }}
        />
      )}
    </section>
  );
}

export function RescheduleModal({
  item,
  onClose,
  onLoadOptions,
  onSubmit,
}: {
  item: Pick<CounselorScheduleCalendarItem, "id" | "startTime" | "endTime" | "roomName" | "centerName">;
  onClose: () => void;
  onLoadOptions: (scheduleId: number, date: string) => Promise<ScheduleRescheduleOptions>;
  onSubmit: (input: { startTime: string; endTime: string; roomId?: string; reason: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(item.startTime.slice(0, 10));
  const [options, setOptions] = useState<ScheduleRescheduleOptions>();
  const [slot, setSlot] = useState<ScheduleRescheduleSlot>();
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError("");
    setSlot(undefined);
    setRoomId("");
    try {
      setOptions(await onLoadOptions(item.id, targetDate));
    } catch (cause) {
      setOptions(undefined);
      setError(cause instanceof Error ? cause.message : "加载可改时段失败");
    } finally {
      setLoading(false);
    }
  }, [item.id, onLoadOptions]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const selectedRoomRequired = options?.centerId !== "video";
  const canSubmit = Boolean(slot?.selectable && reason.trim() && (!selectedRoomRequired || roomId));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6">
      <section aria-modal="true" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog">
        <h3 className="text-lg font-semibold">修改咨询时间</h3>
        <p className="mt-2 text-sm text-[var(--lxxl-muted)]">当前：{formatDateTime(item.startTime)} · {item.roomName || item.centerName}</p>
        <div className="mt-5 grid gap-4">
          <QueryField label="新日期" required>
            <input
              className={queryControlClass}
              min={getLocalDateValue()}
              max={getRollingScheduleMaxDateValue()}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </QueryField>
          {loading && <p className="text-sm text-[var(--lxxl-muted)]">加载中...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {options && (
            <QueryField label="新时间" required>
              <div className="flex flex-wrap gap-2">
                {options.slots.map((candidate) => (
                  <button
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      slot?.key === candidate.key ? "border-[var(--lxxl-green)] bg-[#F4FBF7]" : "border-[var(--lxxl-border)]"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                    disabled={!candidate.selectable}
                    key={candidate.key}
                    title={candidate.unavailableReason || ""}
                    type="button"
                    onClick={() => {
                      setSlot(candidate);
                      setRoomId(candidate.rooms.find((room) => room.available && room.roomId === options.currentRoomId)?.roomId || "");
                    }}
                  >{candidate.key}</button>
                ))}
              </div>
            </QueryField>
          )}
          {slot && selectedRoomRequired && (
            <QueryField label="咨询室" required>
              <div className="flex flex-wrap gap-2">
                {slot.rooms.map((room) => (
                  <button
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      roomId === room.roomId ? "border-[var(--lxxl-green)] bg-[#F4FBF7]" : "border-[var(--lxxl-border)]"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                    disabled={!room.available}
                    key={room.roomId}
                    type="button"
                    onClick={() => setRoomId(room.roomId)}
                  >{room.roomName}{room.available ? "" : "（不可用）"}</button>
                ))}
              </div>
            </QueryField>
          )}
          <QueryField label="修改原因" required>
            <textarea className={`${queryControlClass} min-h-24 resize-y`} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </QueryField>
        </div>
        <div className="mt-6 flex gap-3">
          <QueryButton
            disabled={!canSubmit || submitting}
            onClick={() => {
              if (!slot) return;
              setSubmitting(true);
              void onSubmit({ startTime: slot.startTime, endTime: slot.endTime, roomId: roomId || undefined, reason: reason.trim() })
                .finally(() => setSubmitting(false));
            }}
          >{submitting ? "修改中" : "确认修改"}</QueryButton>
          <QueryResetButton disabled={submitting} onClick={onClose}>取消</QueryResetButton>
        </div>
      </section>
    </div>
  );
}

function canReschedule(item: CounselorScheduleCalendarItem) {
  return item.displayStatus === "BOOKED"
    && (!item.consultationStatus || ["PENDING", "CONFIRMED"].includes(item.consultationStatus))
    && new Date(item.startTime).getTime() > Date.now()
    && !item.leaveRequestId;
}

function calendarCells(month: string, rows: CounselorScheduleCalendarItem[]) {
  const [year, monthValue] = month.split("-").map(Number);
  const first = new Date(year, monthValue - 1, 1);
  const days = new Date(year, monthValue, 0).getDate();
  const pad = (first.getDay() + 6) % 7;
  const counts = new Map<string, number>();
  rows.forEach((item) => {
    const date = item.startTime.slice(0, 10);
    if (item.displayStatus !== "CANCELLED") counts.set(date, (counts.get(date) || 0) + 1);
  });
  return [
    ...Array.from({ length: pad }, () => ({ empty: true as const, date: "", day: 0, count: 0 })),
    ...Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthValue).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { empty: false as const, date, day, count: counts.get(date) || 0 };
    }),
  ];
}

function counselName(name: string) {
  return name.endsWith(" · ") ? name : `${name} · `;
}
