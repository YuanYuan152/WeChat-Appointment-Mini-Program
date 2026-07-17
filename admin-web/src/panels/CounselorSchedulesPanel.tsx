import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { formatDateTime, statusLabel } from "@/lib/format";
import { getLocalDateValue, getRollingScheduleMaxDateValue } from "@/lib/date";
import { getCounselorScheduleHistoryMinDate } from "@/lib/counselorSchedule";
import type { CounselorScheduleQuery } from "@/lib/counselorSchedule";
import { API_BASE_URL } from "@/lib/api";
import {
  fetchCounselorProxySlotOptions,
  pushCounselorProxyOrder,
  searchCounselorProxyPatients,
  type CounselorProxyPatientOption,
} from "@/services/counselor";
import { uploadImage } from "@/services/uploads";
import type {
  CounselorScheduleCalendar,
  CounselorScheduleCalendarItem,
  CounselorSlotOption,
  CounselorSlotOptions,
  ProxySlotOption,
  ProxySlotOptions,
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

export interface CounselorScheduleDraft {
  date: string;
  centerId: string;
  slotKey: string;
  roomId: string;
}

function initialCounselorScheduleDraft(): CounselorScheduleDraft {
  return {
    date: getLocalDateValue(),
    centerId: COUNSELOR_CENTER_OPTIONS[0]?.value || "yangpu",
    slotKey: "",
    roomId: "",
  };
}

export function CounselorSchedulesPanel({
  calendar,
  slotOptions,
  listLoading,
  slotLoading,
  slotError,
  query,
  draft,
  page,
  pageSize,
  focusedScheduleId,
  focusedConsultationId,
  setQuery,
  setDraft,
  onSearch,
  onReset,
  onClearSlotError,
  onLoadSlots,
  onCreate,
  onCancel,
  onLeave,
  onProxyOrderCreated,
  onProxyOrderError,
  onPageChange,
  onPageSizeChange,
}: {
  calendar?: CounselorScheduleCalendar;
  slotOptions?: CounselorSlotOptions;
  listLoading: boolean;
  slotLoading: boolean;
  slotError?: string | null;
  query: CounselorScheduleQuery;
  draft: CounselorScheduleDraft;
  page: number;
  pageSize: number;
  focusedScheduleId?: number | null;
  focusedConsultationId?: number | null;
  setQuery: Dispatch<SetStateAction<CounselorScheduleQuery>>;
  setDraft: Dispatch<SetStateAction<CounselorScheduleDraft>>;
  onSearch: () => void;
  onReset: () => void;
  onClearSlotError: () => void;
  onLoadSlots: (selection?: Pick<CounselorScheduleDraft, "date" | "centerId">) => Promise<boolean> | boolean;
  onCreate: (slot: CounselorSlotOption, roomId: string) => Promise<boolean> | boolean;
  onCancel: (scheduleId: number, reason?: string) => void;
  onLeave: (
    scheduleId: number,
    reason: string,
    communicationScreenshotUrl: string,
  ) => Promise<boolean> | boolean;
  onProxyOrderCreated: (message: string) => Promise<void> | void;
  onProxyOrderError: (message: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const today = getLocalDateValue();
  const historyMinDate = getCounselorScheduleHistoryMinDate(today);
  const [createOpen, setCreateOpen] = useState(false);
  const [proxyOpen, setProxyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { type: "cancel"; schedule: CounselorScheduleCalendarItem }
    | { type: "leave"; schedule: CounselorScheduleCalendarItem }
    | null
  >(null);
  const [reason, setReason] = useState("");
  const [communicationScreenshotUrl, setCommunicationScreenshotUrl] = useState("");
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const communicationScreenshotPreviewUrl = resolveUploadedAssetUrl(communicationScreenshotUrl);
  const visibleSlotOptions =
    slotOptions && slotOptions.date === draft.date && slotOptions.centerId === draft.centerId ? slotOptions : undefined;
  const selectedSlot = visibleSlotOptions?.slots.find((slot) => slot.key === draft.slotKey);
  const availableRooms = selectedSlot?.rooms.filter((room) => room.available && !room.occupiedByOther) || [];
  const rows = useMemo(() => calendar?.slots || [], [calendar?.slots]);
  const total = rows.length;
  const focusedRowId = useMemo(() => {
    const matched = rows.find(
      (item) =>
        (focusedScheduleId && item.id === focusedScheduleId) ||
        (focusedConsultationId && item.consultationId === focusedConsultationId),
    );
    return matched?.id ?? null;
  }, [focusedConsultationId, focusedScheduleId, rows]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  useEffect(() => {
    if (!focusedRowId) {
      return;
    }
    const targetIndex = rows.findIndex((item) => item.id === focusedRowId);
    if (targetIndex < 0) {
      return;
    }
    const targetPage = Math.floor(targetIndex / pageSize) + 1;
    if (targetPage !== page) {
      onPageChange(targetPage);
    }
  }, [focusedRowId, onPageChange, page, pageSize, rows]);

  const resetPendingAction = () => {
    setPendingAction(null);
    setReason("");
    setCommunicationScreenshotUrl("");
    setScreenshotError("");
    setScreenshotUploading(false);
    setActionSubmitting(false);
  };

  const requestLeave = (schedule: CounselorScheduleCalendarItem) => {
    setPendingAction({ type: "leave", schedule });
    setReason(schedule.leaveReason || "");
    setCommunicationScreenshotUrl("");
    setScreenshotError("");
  };

  const requestCancel = (schedule: CounselorScheduleCalendarItem) => {
    setPendingAction({ type: "cancel", schedule });
    setReason("");
    setCommunicationScreenshotUrl("");
    setScreenshotError("");
  };

  const handleScreenshotUpload = async (file?: File) => {
    if (!file) {
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setScreenshotError("仅支持 JPG、PNG、GIF 或 WebP 图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScreenshotError("图片大小不能超过 10MB");
      return;
    }

    setScreenshotUploading(true);
    setScreenshotError("");
    try {
      const result = await uploadImage(file);
      if (!result.url?.trim()) {
        throw new Error("上传接口未返回图片地址");
      }
      setCommunicationScreenshotUrl(result.url.trim());
    } catch (error) {
      setCommunicationScreenshotUrl("");
      setScreenshotError(error instanceof Error ? error.message : "沟通截图上传失败");
    } finally {
      setScreenshotUploading(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }
    if (pendingAction.type === "leave") {
      if (!reason.trim() || !communicationScreenshotUrl || screenshotUploading || actionSubmitting) {
        return;
      }
      setActionSubmitting(true);
      try {
        const submitted = await onLeave(
          pendingAction.schedule.id,
          reason.trim(),
          communicationScreenshotUrl,
        );
        if (submitted) {
          resetPendingAction();
        } else {
          setScreenshotError("请假申请未提交，请根据页面提示检查后重试");
        }
      } catch (error) {
        setScreenshotError(error instanceof Error ? error.message : "请假申请提交失败");
      } finally {
        setActionSubmitting(false);
      }
    } else {
      onCancel(pendingAction.schedule.id, reason || undefined);
      resetPendingAction();
    }
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">我的排期</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                普通模式可向前追溯 30 天，日历模式可按月查看历史；已预约咨询可按规则取消或提交请假申请。
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <QueryButton
                className="w-28"
                type="button"
                onClick={() => {
                  const nextDraft = initialCounselorScheduleDraft();
                  onClearSlotError();
                  setDraft(nextDraft);
                  setCreateOpen(true);
                  void onLoadSlots(nextDraft);
                }}
              >
                新增排期
              </QueryButton>
              <QueryButton className="w-28" type="button" onClick={() => setProxyOpen(true)}>
                代理预约
              </QueryButton>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="展示方式">
              <select
                className={queryControlClass}
                value={query.mode}
                onChange={(event) =>
                  setQuery((prev) => ({
                    ...prev,
                    mode: event.target.value as CounselorScheduleQuery["mode"],
                  }))
                }
              >
                <option value="list">普通模式</option>
                <option value="calendar">日历模式</option>
              </select>
            </QueryField>
            {query.mode === "calendar" ? (
              <QueryField label="月份" required>
                <input
                  className={queryControlClass}
                  required
                  type="month"
                  value={query.month}
                  onChange={(event) => setQuery((prev) => ({ ...prev, month: event.target.value }))}
                />
              </QueryField>
            ) : (
              <>
                <QueryField label="开始日期">
                  <input
                    className={queryControlClass}
                    max={getRollingScheduleMaxDateValue()}
                    min={historyMinDate}
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
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="relative">
          {listLoading && rows.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载排期...
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载排期..." : "暂无排期。"} />
          ) : query.mode === "calendar" ? (
            <CounselorScheduleCalendarView
              focusedRowId={focusedRowId}
              rows={rows}
              onRequestCancel={requestCancel}
              onRequestLeave={requestLeave}
            />
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
                    <tr
                      key={item.id}
                      className={`border-t border-[var(--lxxl-border)] align-top ${
                        item.id === focusedRowId ? "bg-[#FFF9ED]" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)}
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.centerName || "-"}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.roomName || "-"}</td>
                      <td className="px-5 py-4">
                        <Badge tone={scheduleStatusTone(item.displayStatus || item.status)}>
                          {item.displayLabel || statusLabel(item.displayStatus || item.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                        <div>{item.patientName || "-"}</div>
                        {item.patientContractTag && (
                          <div className="mt-1 text-xs font-medium text-[#315D4B]">
                            {formatCounselorContractTag(item.patientContractTag)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.hasCaseRecord ? "已填写" : "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          <ScheduleActionButtons
                            item={item}
                            onRequestCancel={requestCancel}
                            onRequestLeave={requestLeave}
                          />
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

      {createOpen && (
        <CreateScheduleModal
          availableRooms={availableRooms}
          draft={draft}
          onClose={() => {
            onClearSlotError();
            setDraft(initialCounselorScheduleDraft());
            setCreateOpen(false);
          }}
          onCreate={onCreate}
          onLoadSlots={onLoadSlots}
          selectedSlot={selectedSlot}
          setDraft={setDraft}
          slotError={slotError}
          slotLoading={slotLoading}
          slotOptions={visibleSlotOptions}
        />
      )}

      {proxyOpen && (
        <CounselorProxyBookingModal
          onClose={() => setProxyOpen(false)}
          onCreated={(message) => {
            setProxyOpen(false);
            void onProxyOrderCreated(message);
          }}
          onError={onProxyOrderError}
        />
      )}

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
            {pendingAction.type === "leave" && (
              <div className="mt-5">
                <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">
                  沟通截图（必填）
                </span>
                <input
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className={`${queryControlClass} h-auto py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF5F1] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--lxxl-green-dark)]`}
                  disabled={screenshotUploading || actionSubmitting}
                  type="file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void handleScreenshotUpload(file);
                  }}
                />
                <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                  请上传已与来访沟通的截图，支持 JPG、PNG、GIF、WebP，最大 10MB。
                </p>
                {screenshotUploading && (
                  <p className="mt-2 text-sm text-[var(--lxxl-muted)]">正在上传沟通截图...</p>
                )}
                {screenshotError && (
                  <p className="mt-2 text-sm text-[#A13F37]">{screenshotError}</p>
                )}
                {communicationScreenshotUrl && !screenshotUploading && (
                  <a
                    className="mt-3 block rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-2"
                    href={communicationScreenshotPreviewUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="沟通截图预览"
                      className="max-h-44 w-full rounded-lg object-contain"
                      src={communicationScreenshotPreviewUrl}
                    />
                  </a>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <QueryResetButton
                disabled={screenshotUploading || actionSubmitting}
                onClick={resetPendingAction}
              >
                关闭
              </QueryResetButton>
              <QueryButton
                disabled={
                  actionSubmitting ||
                  screenshotUploading ||
                  (pendingAction.type === "leave" &&
                    (!reason.trim() || !communicationScreenshotUrl))
                }
                onClick={() => void confirmPendingAction()}
              >
                {actionSubmitting ? "提交中" : "确认"}
              </QueryButton>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CounselorScheduleCalendarView({
  focusedRowId,
  rows,
  onRequestCancel,
  onRequestLeave,
}: {
  focusedRowId?: number | null;
  rows: CounselorScheduleCalendarItem[];
  onRequestCancel: (item: CounselorScheduleCalendarItem) => void;
  onRequestLeave: (item: CounselorScheduleCalendarItem) => void;
}) {
  const groups = useMemo(() => {
    const grouped = new Map<string, CounselorScheduleCalendarItem[]>();
    rows.forEach((row) => {
      const date = row.startTime.slice(0, 10);
      grouped.set(date, [...(grouped.get(date) || []), row]);
    });
    return Array.from(grouped.entries());
  }, [rows]);

  return (
    <div className="grid gap-4 border-t border-[var(--lxxl-border)] p-5 lg:grid-cols-2 2xl:grid-cols-3">
      {groups.map(([date, items]) => (
        <section className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4" key={date}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{date}</h3>
            <span className="text-xs text-[var(--lxxl-muted)]">{items.length} 条</span>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                className={`rounded-xl p-3 text-sm ${
                  item.id === focusedRowId ? "bg-[#FFF1CF] ring-1 ring-[#D9A94D]" : "bg-[#FAF8F4]"
                }`}
                key={item.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)}
                  </span>
                  <Badge tone={scheduleStatusTone(item.displayStatus || item.status)}>
                    {item.displayLabel || statusLabel(item.displayStatus || item.status)}
                  </Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                  {[item.centerName, item.roomName, item.patientName].filter(Boolean).join(" · ") || "-"}
                </div>
                {item.patientContractTag && (
                  <div className="mt-1 text-xs font-medium text-[#315D4B]">
                    {formatCounselorContractTag(item.patientContractTag)}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  <ScheduleActionButtons
                    item={item}
                    onRequestCancel={onRequestCancel}
                    onRequestLeave={onRequestLeave}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ScheduleActionButtons({
  item,
  onRequestCancel,
  onRequestLeave,
}: {
  item: CounselorScheduleCalendarItem;
  onRequestCancel: (item: CounselorScheduleCalendarItem) => void;
  onRequestLeave: (item: CounselorScheduleCalendarItem) => void;
}) {
  if (item.requiresLeave) {
    return <TableActionButton onClick={() => onRequestLeave(item)}>请假</TableActionButton>;
  }
  if (item.canCancel) {
    return (
      <TableActionButton tone="danger" onClick={() => onRequestCancel(item)}>
        取消排期
      </TableActionButton>
    );
  }
  return <span className="text-[var(--lxxl-muted)]">{item.cancelHint || "-"}</span>;
}

function CounselorProxyBookingModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [patientKeyword, setPatientKeyword] = useState("");
  const [patients, setPatients] = useState<CounselorProxyPatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<CounselorProxyPatientOption | null>(null);
  const [centerId, setCenterId] = useState("yangpu");
  const [date, setDate] = useState(getLocalDateValue());
  const [slotKey, setSlotKey] = useState("");
  const [roomId, setRoomId] = useState("");
  const [slotOptions, setSlotOptions] = useState<ProxySlotOptions>();
  const [patientLoading, setPatientLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slotReloadKey, setSlotReloadKey] = useState(0);
  const [patientError, setPatientError] = useState("");
  const [slotFetchError, setSlotFetchError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setPatientLoading(true);
      setPatientError("");
      try {
        const result = await searchCounselorProxyPatients(patientKeyword);
        if (active) {
          setPatients((result.items || []).filter((patient) => patient.canProxyPush === true));
        }
      } catch (err) {
        if (active) {
          setPatients([]);
          setPatientError(err instanceof Error ? err.message : "来访搜索失败");
        }
      } finally {
        if (active) {
          setPatientLoading(false);
        }
      }
    }, patientKeyword ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patientKeyword]);

  useEffect(() => {
    let active = true;
    setSlotLoading(true);
    setSlotOptions(undefined);
    setSlotKey("");
    setRoomId("");
    setSlotFetchError("");
    void fetchCounselorProxySlotOptions(date, centerId)
      .then((result) => {
        if (active) {
          setSlotOptions(result);
        }
      })
      .catch((err) => {
        if (active) {
          setSlotOptions(undefined);
          setSlotFetchError(err instanceof Error ? err.message : "可预约时段加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setSlotLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [centerId, date, slotReloadKey]);

  const selectedSlot = slotOptions?.slots.find((slot) => slot.key === slotKey);
  const selectedRoom = selectedSlot?.rooms.find((room) => room.roomId === roomId);
  const isVideo = centerId === "video";
  const canSubmit = Boolean(
    selectedPatient?.canProxyPush &&
      selectedSlot?.selectable &&
      !selectedSlot.past &&
      !selectedSlot.counselorOccupied &&
      !selectedSlot.allRoomsFull &&
      (isVideo || (selectedRoom?.available && !selectedRoom.occupiedByOther)),
  );

  async function submit() {
    if (!selectedPatient || !selectedSlot || !canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await pushCounselorProxyOrder({
        patient_id: selectedPatient.id,
        center_id: centerId,
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
        room_id: isVideo ? null : roomId,
        schedule_id: selectedSlot.existingAvailableScheduleId ?? null,
      });
      await onCreated(result.message || "订单已推送");
    } catch (err) {
      const message = err instanceof Error ? err.message : "代理预约订单推送失败";
      setSubmitError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function closeAndReset() {
    if (submitting) {
      return;
    }
    setPatientKeyword("");
    setPatients([]);
    setSelectedPatient(null);
    setCenterId("yangpu");
    setDate(getLocalDateValue());
    setSlotKey("");
    setRoomId("");
    setSlotOptions(undefined);
    setPatientLoading(false);
    setSlotLoading(false);
    setPatientError("");
    setSlotFetchError("");
    setSubmitError("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-6">
      <section
        aria-label="代理预约"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">代理预约</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            仅可为已绑定您且已签约的来访推送订单，支付有效期以推送结果为准。
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <QueryField label="选择来访" required>
            <input
              className={queryControlClass}
              placeholder="输入姓名或手机号搜索"
              value={patientKeyword}
              onChange={(event) => {
                setPatientKeyword(event.target.value);
                setSubmitError("");
                if (selectedPatient && event.target.value !== selectedPatient.name) {
                  setSelectedPatient(null);
                }
              }}
            />
          </QueryField>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--lxxl-border)]">
            {patientLoading ? (
              <div className="px-4 py-4 text-sm text-[var(--lxxl-muted)]">正在搜索来访...</div>
            ) : patients.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[var(--lxxl-muted)]">
                没有匹配的已签约且已绑定来访。
              </div>
            ) : (
              patients.map((patient) => (
                <button
                  className={`flex w-full items-center justify-between gap-4 border-b border-[var(--lxxl-border)] px-4 py-3 text-left last:border-b-0 hover:bg-[#F5F8F6] ${
                    selectedPatient?.id === patient.id ? "bg-[#EEF5F1]" : ""
                  }`}
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setPatientKeyword(patient.name);
                    setSubmitError("");
                  }}
                  type="button"
                >
                  <span>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-xs text-[var(--lxxl-muted)]">
                      {patient.mobile || `编号 ${patient.id}`}
                    </span>
                  </span>
                  <span className="text-xs text-[#315D4B]">
                    {formatCounselorContractTag(patient.contractTag)}
                  </span>
                </button>
              ))
            )}
          </div>
          {patientError && (
            <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">
              {patientError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <QueryField label="日期" required>
              <input
                className={queryControlClass}
                max={getRollingScheduleMaxDateValue()}
                min={getLocalDateValue()}
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSlotKey("");
                  setRoomId("");
                  setSubmitError("");
                }}
              />
            </QueryField>
            <QueryField label="预约中心" required>
              <select
                className={queryControlClass}
                value={centerId}
                onChange={(event) => {
                  setCenterId(event.target.value);
                  setSlotKey("");
                  setRoomId("");
                  setSubmitError("");
                }}
              >
                {COUNSELOR_CENTER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </QueryField>
          </div>

          {slotFetchError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">
              <span>{slotFetchError}</span>
              <button
                className="font-medium text-[var(--lxxl-green-dark)] hover:underline"
                disabled={slotLoading}
                onClick={() => setSlotReloadKey((value) => value + 1)}
                type="button"
              >
                重新加载
              </button>
            </div>
          )}

          {slotLoading ? (
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-4 text-sm text-[var(--lxxl-muted)]">
              正在加载可预约时段...
            </div>
          ) : slotFetchError ? null : !slotOptions ? (
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-4 text-sm text-[var(--lxxl-muted)]">
              暂时无法读取可预约时段。
            </div>
          ) : (
            <div className="space-y-6">
              <QueryField label="时段" required>
                <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--lxxl-muted)]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[#BFD9C9] bg-[#EAF2ED]" />
                    已排期、尚未预约
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[var(--lxxl-border)] bg-white" />
                    尚未排期，可新建
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[var(--lxxl-border)] bg-[#F4F1EB]" />
                    已预约或不可用
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {slotOptions.slots.map((slot) => {
                    const selectable =
                      slot.selectable && !slot.past && !slot.counselorOccupied && !slot.allRoomsFull;
                    const selected = slotKey === slot.key;
                    const existingAvailableSchedule = Boolean(slot.existingAvailableScheduleId);
                    return (
                      <button
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                          selected
                            ? "border-[var(--lxxl-green)] bg-[#F4FBF7]"
                            : selectable && existingAvailableSchedule
                              ? "border-[#BFD9C9] bg-[#EAF2ED] text-[var(--lxxl-green-dark)] hover:border-[var(--lxxl-green)]"
                              : selectable
                                ? "border-[var(--lxxl-border)] bg-white hover:border-[var(--lxxl-green)]"
                                : "cursor-not-allowed border-[var(--lxxl-border)] bg-[#F4F1EB] text-[var(--lxxl-muted)]"
                        }`}
                        disabled={!selectable}
                        key={slot.key}
                        type="button"
                        onClick={() => {
                          setSlotKey(slot.key);
                          setRoomId("");
                          setSubmitError("");
                        }}
                      >
                        <span className="block font-medium">{slot.label}</span>
                        <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">
                          {proxySlotHint(slot)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </QueryField>

              {!isVideo && selectedSlot && (
                <QueryField label="咨询室" required>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedSlot.rooms.map((room) => {
                      const selected = roomId === room.roomId;
                      const selectable = room.available && !room.occupiedByOther;
                      return (
                        <button
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            selected
                              ? "border-[var(--lxxl-green)] bg-[#F4FBF7]"
                              : selectable
                                ? "border-[var(--lxxl-border)] bg-white hover:border-[var(--lxxl-green)]"
                                : "cursor-not-allowed border-[var(--lxxl-border)] bg-[#F4F1EB] text-[var(--lxxl-muted)]"
                          }`}
                          disabled={!selectable}
                          key={room.roomId}
                          type="button"
                          onClick={() => {
                            setRoomId(room.roomId);
                            setSubmitError("");
                          }}
                        >
                          <span className="block font-medium">{room.roomName}</span>
                          <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">
                            {selectable ? "可预约" : "已占用"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </QueryField>
              )}

              {selectedSlot && (
                <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-muted)]">
                  将推送待支付订单：{formatDateTime(selectedSlot.startTime)} 至{" "}
                  {formatDateTime(selectedSlot.endTime)}
                  {!isVideo
                    ? selectedRoom
                      ? ` · ${selectedRoom.roomName}`
                      : " · 请继续选择咨询室"
                    : ""}
                  。
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">
              {submitError}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <QueryButton disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "推送中" : "推送订单"}
          </QueryButton>
          <QueryResetButton disabled={submitting} onClick={closeAndReset}>取消</QueryResetButton>
        </div>
      </section>
    </div>
  );
}

function formatCounselorContractTag(tag?: string | null) {
  if (!tag) {
    return "已签约";
  }
  const counselorName = tag.replace(/^已签约[-—]?\s*/, "").replace(/^【|】$/g, "");
  return counselorName ? `已签约-【${counselorName}】` : "已签约";
}

function scheduleStatusTone(status?: string | null): "neutral" | "green" | "gold" | "red" {
  if (status === "AVAILABLE" || status === "OPEN") {
    return "green";
  }
  if (status === "BOOKED" || status === "PENDING") {
    return "gold";
  }
  if (status === "CANCELLED" || status === "CANCELED" || status === "ON_LEAVE") {
    return "red";
  }
  return "neutral";
}

function resolveUploadedAssetUrl(url: string) {
  const value = url.trim();
  if (!value || /^https?:\/\//i.test(value)) {
    return value;
  }
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function proxySlotHint(slot: ProxySlotOption) {
  if (slot.past) {
    return "已过期";
  }
  if (slot.counselorOccupied) {
    return "当前时段已占用";
  }
  if (slot.allRoomsFull) {
    return "咨询室已满";
  }
  if (slot.existingAvailableScheduleId) {
    return "已有可约排期，可直接代理预约";
  }
  if (slot.selectable) {
    return "尚未排期，可新建代理预约";
  }
  return "不可预约";
}

function CreateScheduleModal({
  availableRooms,
  draft,
  onClose,
  onCreate,
  onLoadSlots,
  selectedSlot,
  setDraft,
  slotError,
  slotLoading,
  slotOptions,
}: {
  availableRooms: CounselorSlotOption["rooms"];
  draft: CounselorScheduleDraft;
  onClose: () => void;
  onCreate: (slot: CounselorSlotOption, roomId: string) => Promise<boolean> | boolean;
  onLoadSlots: (selection?: Pick<CounselorScheduleDraft, "date" | "centerId">) => Promise<boolean> | boolean;
  selectedSlot?: CounselorSlotOption;
  setDraft: Dispatch<SetStateAction<CounselorScheduleDraft>>;
  slotError?: string | null;
  slotLoading: boolean;
  slotOptions?: CounselorSlotOptions;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!selectedSlot || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const created = await onCreate(selectedSlot, draft.roomId);
      if (created) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6 py-6">
      <section
        aria-label="新增排期"
        aria-modal="true"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">新增排期</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            选择日期和预约中心后读取可用时段，再确认新增。
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
            <QueryField label="新增日期">
              <input
                className={queryControlClass}
                disabled={submitting}
                max={getRollingScheduleMaxDateValue()}
                min={getLocalDateValue()}
                type="date"
                value={draft.date}
                onChange={(event) => {
                  const selection = { date: event.target.value, centerId: draft.centerId };
                  setDraft((prev) => ({ ...prev, ...selection, slotKey: "", roomId: "" }));
                  void onLoadSlots(selection);
                }}
              />
            </QueryField>
            <QueryField label="预约中心">
              <select
                className={queryControlClass}
                disabled={submitting}
                value={draft.centerId}
                onChange={(event) => {
                  const selection = { date: draft.date, centerId: event.target.value };
                  setDraft((prev) => ({ ...prev, ...selection, slotKey: "", roomId: "" }));
                  void onLoadSlots(selection);
                }}
              >
                {COUNSELOR_CENTER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </QueryField>
            <div className="flex items-end">
              <QueryButton className="w-28" disabled={slotLoading} onClick={() => void onLoadSlots()}>
                {slotLoading ? "加载中" : "读取时段"}
              </QueryButton>
            </div>
          </div>

          {slotError && (
            <div className="rounded-xl border border-[#F3C9BB] bg-[#FFF4EF] px-4 py-3 text-sm leading-6 text-[#C7542F]">
              {slotError}
            </div>
          )}

          {!slotOptions ? (
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">
              请先读取当前日期和预约中心的可用时段。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <QueryField label="时段">
                <select
                className={queryControlClass}
                  disabled={submitting}
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
                    disabled={submitting}
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
            </div>
          )}
        </div>

        <div className="flex justify-start gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <QueryButton
            disabled={submitting || !selectedSlot || selectedSlot.past || selectedSlot.counselorOccupied || selectedSlot.allRoomsFull}
            onClick={handleCreate}
          >
            {submitting ? "新增中" : "新增"}
          </QueryButton>
          <QueryResetButton disabled={submitting} onClick={onClose}>取消</QueryResetButton>
        </div>
      </section>
    </div>
  );
}
