"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getLocalDateValue } from "@/lib/date";
import { boundCounselorFromPatient, formatPatientInline } from "@/lib/patientContract";
import { fetchPatientContractInfo } from "@/services/boards";
import {
  AGENT_BOOKING_CENTER_OPTIONS,
  AgentBookingPanel,
  proxyOrderSuccessText,
  type AgentBookingDraft,
  type AgentBookingQuery,
} from "@/panels/AgentBookingPanel";
import {
  fetchProxyScheduleCalendar,
  fetchProxySlotOptions,
  pushProxyOrder,
  searchProxyPatients,
} from "@/services/proxyBooking";
import type { ProxyPersonOption, ProxySlotOption } from "@/types/api";
import type { ScreenData } from "@/types/app";

const INITIAL_QUERY = (): AgentBookingQuery => ({
  start: getLocalDateValue(),
  days: 14,
  mode: "list",
});

const INITIAL_DRAFT = (): AgentBookingDraft => ({
  date: getLocalDateValue(),
  centerId: AGENT_BOOKING_CENTER_OPTIONS[0]?.value || "yangpu",
  slotKey: "",
  roomId: "",
  agreementIsAdult: null,
});

export function AgentBookingScreen() {
  return (
    <AppRoute sectionId="proxyBooking">
      <AgentBookingScreenContent />
    </AppRoute>
  );
}

function AgentBookingScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [patient, setPatientState] = useState<ProxyPersonOption>();
  const [counselor, setCounselorState] = useState<ProxyPersonOption>();
  const [activeQuery, setActiveQuery] = useState(INITIAL_QUERY);
  const [draftQuery, setDraftQuery] = useState(INITIAL_QUERY);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [listLoading, setListLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const lastRefreshKey = useRef(refreshKey);

  const applyPatient = useCallback((value?: ProxyPersonOption) => {
    setPatientState(value);
    setCounselorState(boundCounselorFromPatient(value));
  }, []);

  const hydratePrefilledPatient = useCallback(async () => {
    const fallback = readPrefillFromLocation();
    if (!fallback) {
      applyPatient(undefined);
      return;
    }
    try {
      const detail = await fetchPatientContractInfo(fallback.id);
      const patient: ProxyPersonOption = {
        id: detail.patientId,
        name: detail.name,
        mobile: detail.mobile,
        isContractSigned: detail.isContractSigned,
        boundCounselorId: detail.boundCounselorId,
        boundCounselorName: detail.boundCounselorName,
        contractTag: detail.contractTag,
        label: detail.name,
      };
      patient.label = formatPatientInline(patient);
      applyPatient(patient);
    } catch {
      applyPatient(fallback);
    }
  }, [applyPatient]);

  useEffect(() => {
    void hydratePrefilledPatient();
  }, [hydratePrefilledPatient]);

  const clearCalendar = useCallback(() => {
    setData((prev) => ({ ...prev, proxyScheduleCalendar: undefined, proxySlotOptions: undefined }));
    setHasSearched(false);
    setPage(1);
  }, []);

  const setPatient = useCallback(
    (value?: ProxyPersonOption) => {
      applyPatient(value);
      setDraft((prev) => ({ ...prev, slotKey: "", roomId: "", agreementIsAdult: null }));
      clearCalendar();
    },
    [applyPatient, clearCalendar],
  );

  const loadCalendar = useCallback(
    async (query: AgentBookingQuery) => {
      if (!counselor) {
        showNotice("error", "请先选择咨询师");
        return;
      }
      setListLoading(true);
      clearNotice();
      try {
        const proxyScheduleCalendar = await fetchProxyScheduleCalendar({
          counselorId: counselor.id,
          start: query.start,
          days: query.days,
        });
        setData((prev) => ({ ...prev, proxyScheduleCalendar }));
        setActiveQuery(query);
        setHasSearched(true);
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "代理预约排期加载失败");
      } finally {
        setListLoading(false);
      }
    },
    [clearNotice, counselor, showNotice],
  );

  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) {
      return;
    }
    lastRefreshKey.current = refreshKey;
    if (!hasSearched) {
      return;
    }
    void loadCalendar(activeQuery);
  }, [activeQuery, hasSearched, loadCalendar, refreshKey]);

  const search = useCallback(() => {
    if (!patient) {
      showNotice("error", "请先选择来访者");
      return;
    }
    if (!counselor) {
      showNotice("error", "请先选择咨询师");
      return;
    }
    setPage(1);
    void loadCalendar(draftQuery);
  }, [counselor, draftQuery, loadCalendar, patient, showNotice]);

  const reset = useCallback(() => {
    const nextQuery = INITIAL_QUERY();
    const nextDraft = INITIAL_DRAFT();
    void hydratePrefilledPatient();
    setActiveQuery(nextQuery);
    setDraftQuery(nextQuery);
    setDraft(nextDraft);
    setPage(1);
    setData((prev) => ({ ...prev, proxyScheduleCalendar: undefined, proxySlotOptions: undefined }));
    setSlotError(null);
    setHasSearched(false);
    clearNotice();
  }, [clearNotice, hydratePrefilledPatient]);

  const searchPatients = useCallback(async (keyword: string) => {
    const result = await searchProxyPatients(keyword);
    return (result.items || []).map((item) => ({
      ...item,
      label: formatPatientInline(item),
    }));
  }, []);

  const loadSlots = useCallback(async () => {
    if (!patient) {
      setSlotError("请先选择来访者");
      return false;
    }
    if (!counselor) {
      setSlotError("请先选择咨询师");
      return false;
    }
    setSlotLoading(true);
    setSlotError(null);
    try {
      const proxySlotOptions = await fetchProxySlotOptions({
        counselorId: counselor.id,
        date: draft.date,
        centerId: draft.centerId,
      });
      setData((prev) => ({ ...prev, proxySlotOptions }));
      setDraft((prev) => ({ ...prev, slotKey: "", roomId: "" }));
      return true;
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "可代理时段加载失败");
      setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
      return false;
    } finally {
      setSlotLoading(false);
    }
  }, [counselor, draft.centerId, draft.date, patient]);

  const submitProxyOrder = useCallback(
    async (slot: ProxySlotOption, roomId: string) => {
      if (!patient || !counselor) {
        showNotice("error", "请先选择来访者和咨询师");
        return undefined;
      }
      clearNotice();
      setSlotError(null);
      try {
        const result = await pushProxyOrder({
          patientId: patient.id,
          counselorId: counselor.id,
          centerId: draft.centerId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: roomId || undefined,
          scheduleId: slot.existingAvailableScheduleId || slot.counselorScheduleId || undefined,
          agreementIsAdult: patient.isContractSigned
            ? undefined
            : draft.agreementIsAdult === null
              ? undefined
              : draft.agreementIsAdult,
        });
        showNotice("success", proxyOrderSuccessText(result));
        await loadCalendar(activeQuery);
        await loadSlots();
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "代理预约订单推送失败";
        setSlotError(message);
        showNotice("error", message);
        return undefined;
      }
    },
    [activeQuery, clearNotice, counselor, draft.agreementIsAdult, draft.centerId, loadCalendar, loadSlots, patient, showNotice],
  );

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <AgentBookingPanel
      calendar={data.proxyScheduleCalendar}
      counselor={counselor}
      draft={draft}
      listLoading={listLoading}
      page={page}
      pageSize={pageSize}
      patient={patient}
      query={draftQuery}
      setDraft={setDraft}
      setPatient={setPatient}
      setQuery={setDraftQuery}
      slotError={slotError}
      slotLoading={slotLoading}
      slotOptions={data.proxySlotOptions}
      onClearSlotError={() => setSlotError(null)}
      onLoadSlots={loadSlots}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onPushOrder={submitProxyOrder}
      onReset={reset}
      onSearch={search}
      onSearchPatients={searchPatients}
    />
  );
}

function readPrefillFromLocation(): ProxyPersonOption | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("patientId"));
  if (!Number.isFinite(id) || id <= 0) {
    return undefined;
  }
  const name = params.get("patientName") || `来访#${id}`;
  const mobile = params.get("patientMobile") || undefined;
  const boundCounselorId = Number(params.get("boundCounselorId"));
  const boundCounselorName = params.get("boundCounselorName") || undefined;
  return {
    id,
    name,
    mobile,
    isContractSigned: params.get("isContractSigned") === "1",
    boundCounselorId: Number.isFinite(boundCounselorId) && boundCounselorId > 0 ? boundCounselorId : undefined,
    boundCounselorName,
    label: mobile ? `${name} · ${mobile}` : `${name} · ID ${id}`,
  };
}
