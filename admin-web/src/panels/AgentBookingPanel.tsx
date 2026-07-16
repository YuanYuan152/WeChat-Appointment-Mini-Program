import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";
import { getLocalDateValue, getRollingScheduleMaxDateValue } from "@/lib/date";
import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import {
  formatPatientInline,
  formatPatientNameWithContractTag,
  patientContractTag,
} from "@/lib/patientContract";
import type {
  ProxyPersonOption,
  ProxyPushOrderResult,
  ProxyScheduleCalendar,
  ProxyScheduleCalendarItem,
  ProxySlotOption,
  ProxySlotOptions,
} from "@/types/api";

export const AGENT_BOOKING_CENTER_OPTIONS = [
  { value: "yangpu", label: "杨浦预约中心" },
  { value: "pudong", label: "浦东预约中心" },
  { value: "video", label: "视频咨询" },
];

export interface AgentBookingQuery {
  start: string;
  days: number;
  mode: "list" | "calendar";
}

export interface AgentBookingDraft {
  date: string;
  centerId: string;
  slotKey: string;
  roomId: string;
  agreementIsAdult: boolean | null;
}

export function AgentBookingPanel({
  calendar,
  slotOptions,
  patient,
  counselor,
  listLoading,
  slotLoading,
  slotError,
  patientStatusLoading,
  patientStatusError,
  query,
  draft,
  page,
  pageSize,
  setPatient,
  setQuery,
  setDraft,
  onSearchPatients,
  onSearch,
  onReset,
  onRefreshPatient,
  onOpenCreate,
  onCloseCreate,
  onLoadSlots,
  onPushOrder,
  onPageChange,
  onPageSizeChange,
}: {
  calendar?: ProxyScheduleCalendar;
  slotOptions?: ProxySlotOptions;
  patient?: ProxyPersonOption;
  counselor?: ProxyPersonOption;
  listLoading: boolean;
  slotLoading: boolean;
  slotError?: string | null;
  patientStatusLoading: boolean;
  patientStatusError?: string | null;
  query: AgentBookingQuery;
  draft: AgentBookingDraft;
  page: number;
  pageSize: number;
  setPatient: (value?: ProxyPersonOption) => void;
  setQuery: Dispatch<SetStateAction<AgentBookingQuery>>;
  setDraft: Dispatch<SetStateAction<AgentBookingDraft>>;
  onSearchPatients: (keyword: string) => Promise<ProxyPersonOption[]>;
  onSearch: () => void;
  onReset: () => void;
  onRefreshPatient: () => Promise<ProxyPersonOption | undefined>;
  onOpenCreate: () => Promise<boolean>;
  onCloseCreate: () => void;
  onLoadSlots: (selection?: Pick<AgentBookingDraft, "date" | "centerId">) => Promise<boolean> | boolean;
  onPushOrder: (slot: ProxySlotOption, roomId: string) => Promise<ProxyPushOrderResult | undefined>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const today = getLocalDateValue();
  const rollingMaxDate = getRollingScheduleMaxDateValue();
  const [createOpen, setCreateOpen] = useState(false);
  const [openingCreate, setOpeningCreate] = useState(false);
  const rows = useMemo(() => calendar?.slots || [], [calendar?.slots]);
  const total = rows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);
  const visibleSlotOptions =
    slotOptions && slotOptions.date === draft.date && slotOptions.centerId === draft.centerId ? slotOptions : undefined;
  const selectedSlot = visibleSlotOptions?.slots.find((slot) => slot.key === draft.slotKey);
  const selectedRoom = selectedSlot?.rooms.find((room) => room.roomId === draft.roomId);
  const canOpenCreate = Boolean(patient && counselor && !patientStatusLoading && !patientStatusError);

  const openCreate = async () => {
    setOpeningCreate(true);
    try {
      if (await onOpenCreate()) {
        setCreateOpen(true);
      }
    } finally {
      setOpeningCreate(false);
    }
  };

  const closeCreate = () => {
    onCloseCreate();
    setCreateOpen(false);
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
              <h2 className="text-xl font-semibold tracking-normal">代理预约</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                选择来访后自动使用其绑定咨询师，推送待支付订单。
              </p>
            </div>
            <QueryButton
              className="w-28"
              disabled={!canOpenCreate || openingCreate}
              type="button"
              onClick={() => void openCreate()}
            >
              {openingCreate ? "校验中" : "代理预约"}
            </QueryButton>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SearchablePersonSelect
              label="来访者"
              placeholder="姓名或电话"
              required
              search={onSearchPatients}
              value={patient}
              onChange={setPatient}
            />
            <QueryField label="绑定咨询师" required>
              <div
                aria-invalid={Boolean(patientStatusError)}
                aria-readonly="true"
                className={`${queryControlClass} flex items-center justify-between gap-3 ${
                  patientStatusError
                    ? "text-[#A13F37]"
                    : counselor
                      ? "font-medium"
                      : "text-[var(--lxxl-muted)]"
                }`}
              >
                <span className="truncate">
                  {patientStatusError
                    ? "绑定状态读取失败"
                    : counselor?.name || (patient ? "来访尚未绑定咨询师" : "请先选择来访")}
                </span>
                {patientStatusError ? (
                  <Badge tone="red">已锁定</Badge>
                ) : patientStatusLoading ? (
                  <Badge>校验中</Badge>
                ) : counselor ? (
                  <Badge>自动锁定</Badge>
                ) : patient ? (
                  <Badge tone="gold">不可预约</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                根据来访当前绑定关系自动带出，不能在代理预约中更换。
              </p>
            </QueryField>
            <QueryField label="签约状态">
              <div className={`${queryControlClass} flex items-center gap-2`}>
                {patientStatusLoading ? (
                  <Badge>读取中</Badge>
                ) : patientStatusError ? (
                  <Badge tone="red">读取失败</Badge>
                ) : patient ? (
                  <Badge tone={patient.isContractSigned ? "green" : "gold"}>
                    {patient.isContractSigned ? "已签约" : "未签约"}
                  </Badge>
                ) : (
                  <span className="text-[var(--lxxl-muted)]">请先选择来访</span>
                )}
                {patientContractTag(patient) && (
                  <span className="truncate text-xs text-[var(--lxxl-muted)]">{patientContractTag(patient)}</span>
                )}
              </div>
            </QueryField>
            <QueryField label="开始日期">
              <input
                className={queryControlClass}
                max={rollingMaxDate}
                min={today}
                type="date"
                value={query.start}
                onChange={(event) => setQuery((prev) => ({ ...prev, start: event.target.value }))}
              />
            </QueryField>
            <QueryField label="展示方式">
              <select
                className={queryControlClass}
                value={query.mode}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, mode: event.target.value as AgentBookingQuery["mode"] }))
                }
              >
                <option value="list">普通模式</option>
                <option value="calendar">日历模式</option>
              </select>
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

          {patient && patientStatusError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F3C9BB] bg-[#FFF4EF] px-4 py-3 text-sm text-[#C7542F]">
              <span>签约与绑定状态读取失败，已停止代理预约。请重试后再继续。</span>
              <button
                className="font-medium underline underline-offset-2"
                type="button"
                onClick={() => void onRefreshPatient()}
              >
                重新读取
              </button>
            </div>
          )}

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
          {!calendar ? (
            <EmptyState
              text={
                listLoading
                  ? "正在加载排期..."
                  : !patient
                    ? "请先选择来访者。"
                    : patientStatusError
                      ? "签约与绑定状态读取失败，请重新读取后再预约。"
                    : !counselor
                      ? "该来访尚未绑定咨询师，请先在来访者详情中绑定。"
                      : "点击查询查看绑定咨询师的排期。"
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载排期..." : "当前咨询师暂无未来排期，可点击代理预约创建新时段。"} />
          ) : query.mode === "calendar" ? (
            <ScheduleCalendarView rows={rows} />
          ) : (
            <>
              <ScheduleTable rows={pagedRows} />
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
        <ProxyBookingModal
          counselor={counselor}
          draft={draft}
          patient={patient}
          selectedRoom={selectedRoom}
          selectedSlot={selectedSlot}
          setDraft={setDraft}
          slotError={slotError}
          slotLoading={slotLoading}
          slotOptions={visibleSlotOptions}
          patientStatusError={patientStatusError}
          patientStatusLoading={patientStatusLoading}
          onClose={closeCreate}
          onLoadSlots={onLoadSlots}
          onPushOrder={onPushOrder}
          onRefreshPatient={onRefreshPatient}
        />
      )}
    </>
  );
}

function SearchablePersonSelect({
  label,
  placeholder,
  required,
  value,
  search,
  onChange,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  value?: ProxyPersonOption;
  search: (keyword: string) => Promise<ProxyPersonOption[]>;
  onChange: (value?: ProxyPersonOption) => void;
}) {
  const [inputValue, setInputValue] = useState(value?.name || "");
  const [options, setOptions] = useState<ProxyPersonOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const searchSeq = useRef(0);
  const preserveTypedInput = useRef(false);

  useEffect(() => {
    if (!value && preserveTypedInput.current) {
      preserveTypedInput.current = false;
      return;
    }
    preserveTypedInput.current = false;
    setInputValue(value?.name || "");
  }, [value]);

  useEffect(() => {
    if (!open) {
      searchSeq.current += 1;
      setLoading(false);
      return;
    }
    const seq = searchSeq.current + 1;
    searchSeq.current = seq;
    setLoading(true);
    setSearchError("");
    const timer = window.setTimeout(() => {
      void search(inputValue)
        .then((items) => {
          if (searchSeq.current === seq) {
            setOptions(items);
            const exactMatch = value ? undefined : uniqueExactPersonMatch(items, inputValue);
            if (exactMatch) {
              onChange(exactMatch);
              setInputValue(exactMatch.name);
              setOpen(false);
            }
          }
        })
        .catch((error) => {
          if (searchSeq.current === seq) {
            setOptions([]);
            setSearchError(error instanceof Error ? error.message : "搜索失败，请重试");
          }
        })
        .finally(() => {
          if (searchSeq.current === seq) {
            setLoading(false);
          }
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [inputValue, onChange, open, retryKey, search, value]);

  return (
    <QueryField label={label} required={required}>
      <div className="relative">
        <input
          className={queryControlClass}
          placeholder={placeholder}
          value={inputValue}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (value) {
              preserveTypedInput.current = true;
              onChange(undefined);
            }
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
        />
        {open && (
          <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[var(--lxxl-border)] bg-white p-1 text-sm shadow-lg">
            {loading ? (
              <div className="px-3 py-3 text-[var(--lxxl-muted)]">正在搜索...</div>
            ) : searchError ? (
              <div className="flex items-center justify-between gap-3 px-3 py-3 text-[#A13F37]">
                <span>{searchError}</span>
                <button
                  className="shrink-0 font-medium underline underline-offset-2"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRetryKey((value) => value + 1)}
                >
                  重试
                </button>
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-3 text-[var(--lxxl-muted)]">暂无匹配结果</div>
            ) : (
              options.map((item) => (
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#FAF8F4]"
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item);
                    setInputValue(item.name);
                    setOpen(false);
                  }}
                >
                  <span className="block font-medium">{formatPatientInline(item)}</span>
                  <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">
                    {[item.mobile || `ID ${item.id}`, item.boundCounselorName ? `绑定：${item.boundCounselorName}` : "未绑定咨询师"].join(" · ")}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </QueryField>
  );
}

function uniqueExactPersonMatch(items: ProxyPersonOption[], inputValue: string) {
  const keyword = normalizePersonSearchValue(inputValue);
  if (!keyword) {
    return undefined;
  }
  const matches = items.filter((item) =>
    [item.name, item.mobile].some((value) => normalizePersonSearchValue(value) === keyword),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function normalizePersonSearchValue(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase();
}

function ScheduleTable({ rows }: { rows: ProxyScheduleCalendarItem[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
        <tr>
          <th className="px-5 py-3 font-medium">时间</th>
          <th className="px-5 py-3 font-medium">预约中心</th>
          <th className="px-5 py-3 font-medium">咨询室</th>
          <th className="px-5 py-3 font-medium">状态</th>
          <th className="px-5 py-3 font-medium">来访者</th>
          <th className="px-5 py-3 font-medium">咨询记录</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr className="border-t border-[var(--lxxl-border)] align-top" key={item.id}>
            <td className="px-5 py-4">{timeRangeText(item.startTime, item.endTime)}</td>
            <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.centerName || "-"}</td>
            <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.roomName || "-"}</td>
            <td className="px-5 py-4">
              <Badge tone={scheduleStatusTone(item)}>{scheduleStatusLabel(item)}</Badge>
            </td>
            <td className="px-5 py-4 text-[var(--lxxl-muted)]">
              {formatPatientNameWithContractTag(item.patientName, item.patientContractTag) || "-"}
            </td>
            <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.hasCaseRecord ? "已填写" : "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleCalendarView({ rows }: { rows: ProxyScheduleCalendarItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, ProxyScheduleCalendarItem[]>();
    rows.forEach((row) => {
      const key = row.startTime.slice(0, 10);
      map.set(key, [...(map.get(key) || []), row]);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="grid gap-4 border-t border-[var(--lxxl-border)] p-5 lg:grid-cols-2 2xl:grid-cols-3">
      {groups.map(([date, items]) => (
        <div className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4" key={date}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{date}</div>
            <div className="text-xs text-[var(--lxxl-muted)]">{items.length} 条</div>
          </div>
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div className="rounded-xl bg-[#FAF8F4] p-3 text-sm" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{timeRangeText(item.startTime, item.endTime)}</span>
                  <Badge tone={scheduleStatusTone(item)}>{scheduleStatusLabel(item)}</Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                  {[
                    item.centerName,
                    item.roomName,
                    formatPatientNameWithContractTag(item.patientName, item.patientContractTag),
                  ].filter(Boolean).join(" · ") || "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProxyBookingModal({
  patient,
  counselor,
  draft,
  setDraft,
  slotOptions,
  selectedSlot,
  selectedRoom,
  slotLoading,
  slotError,
  patientStatusLoading,
  patientStatusError,
  onLoadSlots,
  onPushOrder,
  onRefreshPatient,
  onClose,
}: {
  patient?: ProxyPersonOption;
  counselor?: ProxyPersonOption;
  draft: AgentBookingDraft;
  setDraft: Dispatch<SetStateAction<AgentBookingDraft>>;
  slotOptions?: ProxySlotOptions;
  selectedSlot?: ProxySlotOption;
  selectedRoom?: ProxySlotOption["rooms"][number];
  slotLoading: boolean;
  slotError?: string | null;
  patientStatusLoading: boolean;
  patientStatusError?: string | null;
  onLoadSlots: (selection?: Pick<AgentBookingDraft, "date" | "centerId">) => Promise<boolean> | boolean;
  onPushOrder: (slot: ProxySlotOption, roomId: string) => Promise<ProxyPushOrderResult | undefined>;
  onRefreshPatient: () => Promise<ProxyPersonOption | undefined>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const needsRoom = draft.centerId !== "video";
  const canSubmit = Boolean(
    patient &&
      counselor &&
      !patientStatusLoading &&
      !patientStatusError &&
      selectedSlot &&
      selectedSlot.selectable &&
      !selectedSlot.past &&
      !selectedSlot.counselorOccupied &&
      (patient?.isContractSigned || draft.agreementIsAdult !== null) &&
      (!needsRoom || (selectedRoom?.available && !selectedRoom.occupiedByOther)),
  );

  const handlePush = async () => {
    if (!selectedSlot || !canSubmit) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await onPushOrder(selectedSlot, needsRoom ? draft.roomId : "");
      if (result) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6 py-6">
      <section
        aria-label="代理预约"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">代理预约</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            {patient ? `来访者：${formatPatientInline(patient)}` : "未选择来访者"} ·{" "}
            {counselor ? `咨询师：${counselor.name}` : "未选择咨询师"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]">
            <QueryField label="日期" required>
              <input
                className={queryControlClass}
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
            <QueryField label="预约中心" required>
              <select
                className={queryControlClass}
                value={draft.centerId}
                onChange={(event) => {
                  const selection = { date: draft.date, centerId: event.target.value };
                  setDraft((prev) => ({ ...prev, ...selection, slotKey: "", roomId: "" }));
                  void onLoadSlots(selection);
                }}
              >
                {AGENT_BOOKING_CENTER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </QueryField>
            <div className="flex items-end">
              <QueryButton className="w-28" disabled={slotLoading} onClick={() => void onLoadSlots()}>
                {slotLoading ? "加载中" : "重新读取"}
              </QueryButton>
            </div>
          </div>

          {slotError && (
            <div className="mt-4 rounded-xl border border-[#F3C9BB] bg-[#FFF4EF] px-4 py-3 text-sm leading-6 text-[#C7542F]">
              {slotError}
            </div>
          )}

          {patientStatusError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F3C9BB] bg-[#FFF4EF] px-4 py-3 text-sm text-[#C7542F]">
              <span>签约与绑定状态读取失败，暂时不能推送订单。</span>
              <button
                className="font-medium underline underline-offset-2"
                type="button"
                onClick={() => void onRefreshPatient()}
              >
                重新读取
              </button>
            </div>
          )}

          {patient && !patient.isContractSigned && (
            <QueryField className="mt-5" label="签约协议" required>
              <p className="mb-3 text-xs leading-5 text-[var(--lxxl-muted)]">
                未签约来访需选择推送的协议，来访支付前将按此协议签署。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={`rounded-xl border px-4 py-3 text-sm transition ${
                    draft.agreementIsAdult === true
                      ? "border-[var(--lxxl-green)] bg-[#F4FBF7] text-[var(--lxxl-green-dark)]"
                      : "border-[var(--lxxl-border)] bg-white hover:border-[var(--lxxl-green)]"
                  }`}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, agreementIsAdult: true }))}
                >
                  同心理咨询协议
                </button>
                <button
                  className={`rounded-xl border px-4 py-3 text-sm transition ${
                    draft.agreementIsAdult === false
                      ? "border-[var(--lxxl-green)] bg-[#F4FBF7] text-[var(--lxxl-green-dark)]"
                      : "border-[var(--lxxl-border)] bg-white hover:border-[var(--lxxl-green)]"
                  }`}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, agreementIsAdult: false }))}
                >
                  “扬帆计划”协议
                </button>
              </div>
            </QueryField>
          )}

          {!slotOptions ? (
            <div className="mt-5 rounded-xl bg-[#FAF8F4] px-4 py-4 text-sm text-[var(--lxxl-muted)]">
              {slotLoading ? "正在读取当前日期和预约中心的可用时段..." : "暂无可用时段，请重新读取。"}
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              <QueryField label="时段" required>
                <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--lxxl-muted)]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[#BFD9C9] bg-[#EAF2ED]" />
                    咨询师已排期、尚未预约
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[var(--lxxl-border)] bg-white" />
                    咨询师尚未排期，可新建
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm border border-[var(--lxxl-border)] bg-[#F4F1EB]" />
                    已预约或不可用
                  </span>
                </div>
                {slotOptions.slots.length === 0 ? (
                  <div className="rounded-xl bg-[#FAF8F4] px-4 py-4 text-sm text-[var(--lxxl-muted)]">
                    当前日期和预约中心暂无可代理时段。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {slotOptions.slots.map((slot) => {
                      const selectable = slot.selectable && !slot.past && !slot.counselorOccupied && !slot.allRoomsFull;
                      const selected = draft.slotKey === slot.key;
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
                          onClick={() => setDraft((prev) => ({ ...prev, slotKey: slot.key, roomId: "" }))}
                        >
                          <span className="block font-medium">{slot.label}</span>
                          <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">{slotHint(slot)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </QueryField>

              {draft.centerId !== "video" && selectedSlot && (
                <QueryField label="咨询室" required>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedSlot.rooms.map((room) => {
                      const selected = draft.roomId === room.roomId;
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
                          onClick={() => setDraft((prev) => ({ ...prev, roomId: room.roomId }))}
                        >
                          <span className="block font-medium">{room.roomName}</span>
                          <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">
                            {room.available && !room.occupiedByOther ? "可预约" : "已占用"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </QueryField>
              )}

              {selectedSlot && (
                <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-muted)]">
                  将推送待支付订单：{timeRangeText(selectedSlot.startTime, selectedSlot.endTime)}
                  {draft.centerId !== "video"
                    ? selectedRoom
                      ? ` · ${selectedRoom.roomName}`
                      : " · 请继续选择咨询室"
                    : ""}
                  。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-start gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <QueryButton className="w-28" disabled={!canSubmit || submitting} onClick={handlePush}>
            {submitting ? "推送中" : "推送订单"}
          </QueryButton>
          <QueryResetButton disabled={submitting} onClick={onClose}>取消</QueryResetButton>
        </div>
      </section>
    </div>
  );
}

function timeRangeText(startTime?: string | null, endTime?: string | null) {
  return `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`;
}

function statusTone(status?: string | null): "neutral" | "green" | "gold" | "red" {
  if (status === "PENDING_PAYMENT") {
    return "neutral";
  }
  if (status === "AVAILABLE" || status === "OPEN") {
    return "green";
  }
  if (status === "BOOKED" || status === "PENDING") {
    return "gold";
  }
  if (status === "CANCELLED" || status === "CANCELED") {
    return "red";
  }
  return "neutral";
}

function scheduleStatusLabel(item: ProxyScheduleCalendarItem) {
  return item.displayLabel || statusLabel(item.displayStatus || item.status);
}

function scheduleStatusTone(item: ProxyScheduleCalendarItem) {
  return statusTone(item.displayStatus || item.status);
}

function slotHint(slot: ProxySlotOption) {
  if (slot.past) {
    return "已过期";
  }
  if (slot.counselorOccupied) {
    return "咨询师该时段已占用";
  }
  if (slot.allRoomsFull) {
    return "咨询室已满";
  }
  if (slot.existingAvailableScheduleId) {
    return "咨询师已有可约排期，可直接代理";
  }
  if (slot.selectable) {
    return "咨询师尚未排期，可新建代理预约";
  }
  return "不可预约";
}

export function proxyOrderSuccessText(result: ProxyPushOrderResult) {
  return `${result.message || "订单已推送"}，金额 ${formatMoneyFromCents(result.totalFee)}`;
}
