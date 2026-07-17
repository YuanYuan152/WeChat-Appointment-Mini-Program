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
  const [patientStatusLoading, setPatientStatusLoading] = useState(false);
  const [patientStatusError, setPatientStatusError] = useState<string | null>(null);
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
  const patientRef = useRef<ProxyPersonOption | undefined>(undefined);
  const counselorRef = useRef<ProxyPersonOption | undefined>(undefined);
  const patientRequestSeq = useRef(0);
  const calendarRequestSeq = useRef(0);
  const slotRequestSeq = useRef(0);

  const applyPatient = useCallback((value?: ProxyPersonOption) => {
    const nextCounselor = boundCounselorFromPatient(value);
    patientRef.current = value;
    counselorRef.current = nextCounselor;
    setPatientState(value);
    setCounselorState(nextCounselor);
  }, []);

  const refreshPatientContract = useCallback(
    async (selectedPatient = patientRef.current, notifyOnError = false) => {
      if (!selectedPatient) {
        return undefined;
      }

      const patientId = selectedPatient.id;
      const requestSeq = patientRequestSeq.current + 1;
      patientRequestSeq.current = requestSeq;
      setPatientStatusLoading(true);
      setPatientStatusError(null);

      try {
        const detail = await fetchPatientContractInfo(patientId);
        if (patientRequestSeq.current !== requestSeq || patientRef.current?.id !== patientId) {
          return undefined;
        }

        const nextPatient = patientFromContractDetail(detail);
        const bindingChanged = patientRef.current?.boundCounselorId !== nextPatient.boundCounselorId;
        applyPatient(nextPatient);
        if (bindingChanged) {
          calendarRequestSeq.current += 1;
          slotRequestSeq.current += 1;
          setListLoading(false);
          setSlotLoading(false);
          setData((prev) => ({
            ...prev,
            proxyScheduleCalendar: undefined,
            proxySlotOptions: undefined,
          }));
          setHasSearched(false);
          setPage(1);
          setDraft((prev) => ({ ...prev, slotKey: "", roomId: "" }));
        }
        return nextPatient;
      } catch (error) {
        if (patientRequestSeq.current === requestSeq && patientRef.current?.id === patientId) {
          const message = error instanceof Error ? error.message : "签约与绑定状态读取失败，请重试";
          setPatientStatusError(message);
          if (notifyOnError) {
            showNotice("error", message);
          }
        }
        return undefined;
      } finally {
        if (patientRequestSeq.current === requestSeq) {
          setPatientStatusLoading(false);
        }
      }
    },
    [applyPatient, showNotice],
  );

  const hydratePrefilledPatient = useCallback(() => {
    const fallback = readPrefillFromLocation();
    if (!fallback) {
      patientRequestSeq.current += 1;
      applyPatient(undefined);
      setPatientStatusLoading(false);
      setPatientStatusError(null);
      return;
    }
    applyPatient(fallback);
    void refreshPatientContract(fallback);
  }, [applyPatient, refreshPatientContract]);

  useEffect(() => {
    hydratePrefilledPatient();
  }, [hydratePrefilledPatient]);

  const clearCalendar = useCallback(() => {
    calendarRequestSeq.current += 1;
    slotRequestSeq.current += 1;
    setListLoading(false);
    setSlotLoading(false);
    setData((prev) => ({ ...prev, proxyScheduleCalendar: undefined, proxySlotOptions: undefined }));
    setHasSearched(false);
    setPage(1);
  }, []);

  const setPatient = useCallback(
    (value?: ProxyPersonOption) => {
      patientRequestSeq.current += 1;
      setPatientStatusLoading(false);
      setPatientStatusError(null);
      applyPatient(value);
      setDraft(INITIAL_DRAFT());
      setSlotError(null);
      clearCalendar();
      // 搜索结果先用于即时回填绑定咨询师，再立即读取来访详情进行权威校准。
      // 这样既不会让用户等待才能看到绑定关系，也不会一直依赖可能过期的
      // 搜索快照；校准失败时 patientStatusError 会锁住查询和推单。
      if (value) {
        void refreshPatientContract(value);
      }
    },
    [applyPatient, clearCalendar, refreshPatientContract],
  );

  const loadCalendar = useCallback(
    async (
      query: AgentBookingQuery,
      selectedCounselor = counselorRef.current,
      options: { clearExistingNotice?: boolean; notifyOnError?: boolean } = {},
    ) => {
      const { clearExistingNotice = true, notifyOnError = true } = options;
      if (!selectedCounselor) {
        if (notifyOnError) {
          showNotice("error", "请先选择咨询师");
        }
        return "error" as const;
      }
      const requestSeq = calendarRequestSeq.current + 1;
      calendarRequestSeq.current = requestSeq;
      setListLoading(true);
      if (clearExistingNotice) {
        clearNotice();
      }
      try {
        const proxyScheduleCalendar = await fetchProxyScheduleCalendar({
          counselorId: selectedCounselor.id,
          start: query.start,
          days: query.days,
        });
        if (calendarRequestSeq.current !== requestSeq || counselorRef.current?.id !== selectedCounselor.id) {
          return "stale" as const;
        }
        setData((prev) => ({ ...prev, proxyScheduleCalendar }));
        setActiveQuery(query);
        setHasSearched(true);
        return "success" as const;
      } catch (error) {
        if (calendarRequestSeq.current === requestSeq && notifyOnError) {
          showNotice("error", error instanceof Error ? error.message : "代理预约排期加载失败");
        }
        return "error" as const;
      } finally {
        if (calendarRequestSeq.current === requestSeq) {
          setListLoading(false);
        }
      }
    },
    [clearNotice, showNotice],
  );

  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) {
      return;
    }
    lastRefreshKey.current = refreshKey;
    void (async () => {
      const selectedPatient = patientRef.current;
      const latestPatient = selectedPatient ? await refreshPatientContract(selectedPatient) : undefined;
      const latestCounselor = boundCounselorFromPatient(latestPatient);
      if (hasSearched && latestCounselor) {
        await loadCalendar(activeQuery, latestCounselor);
      }
    })();
  }, [activeQuery, hasSearched, loadCalendar, refreshKey, refreshPatientContract]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (patientRef.current) {
        void refreshPatientContract(patientRef.current);
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refreshPatientContract]);

  const search = useCallback(async () => {
    const selectedPatient = patientRef.current;
    if (!selectedPatient) {
      showNotice("error", "请先选择来访者");
      return;
    }
    const latestPatient = await refreshPatientContract(selectedPatient, true);
    if (!latestPatient) {
      return;
    }
    const latestCounselor = boundCounselorFromPatient(latestPatient);
    if (!latestCounselor) {
      showNotice("error", "该来访尚未绑定咨询师，请先在来访者详情中绑定");
      return;
    }
    setPage(1);
    await loadCalendar(draftQuery, latestCounselor);
  }, [draftQuery, loadCalendar, refreshPatientContract, showNotice]);

  const reset = useCallback(() => {
    const nextQuery = INITIAL_QUERY();
    patientRequestSeq.current += 1;
    calendarRequestSeq.current += 1;
    slotRequestSeq.current += 1;
    hydratePrefilledPatient();
    setActiveQuery(nextQuery);
    setDraftQuery(nextQuery);
    setDraft(INITIAL_DRAFT());
    setPage(1);
    setListLoading(false);
    setSlotLoading(false);
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

  const loadSlots = useCallback(async (
    selection: Pick<AgentBookingDraft, "date" | "centerId"> = {
      date: draft.date,
      centerId: draft.centerId,
    },
    selectedPatient = patientRef.current,
  ) => {
    if (!selectedPatient) {
      setSlotError("请先选择来访者");
      return false;
    }
    const selectedCounselor = boundCounselorFromPatient(selectedPatient);
    if (!selectedCounselor) {
      setSlotError("该来访尚未绑定咨询师，请先在来访者详情中绑定");
      return false;
    }
    const requestSeq = slotRequestSeq.current + 1;
    slotRequestSeq.current = requestSeq;
    setSlotLoading(true);
    setSlotError(null);
    setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
    setDraft((prev) => ({ ...prev, ...selection, slotKey: "", roomId: "" }));
    try {
      const proxySlotOptions = await fetchProxySlotOptions({
        counselorId: selectedCounselor.id,
        date: selection.date,
        centerId: selection.centerId,
      });
      if (
        slotRequestSeq.current !== requestSeq ||
        patientRef.current?.id !== selectedPatient.id ||
        counselorRef.current?.id !== selectedCounselor.id
      ) {
        return false;
      }
      setData((prev) => ({ ...prev, proxySlotOptions }));
      return true;
    } catch (error) {
      if (slotRequestSeq.current === requestSeq) {
        setSlotError(error instanceof Error ? error.message : "可代理时段加载失败");
        setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
      }
      return false;
    } finally {
      if (slotRequestSeq.current === requestSeq) {
        setSlotLoading(false);
      }
    }
  }, [draft.centerId, draft.date]);

  const prepareCreate = useCallback(async () => {
    const selectedPatient = patientRef.current;
    if (!selectedPatient) {
      showNotice("error", "请先选择来访者");
      return false;
    }
    const latestPatient = await refreshPatientContract(selectedPatient, true);
    if (!latestPatient) {
      return false;
    }
    if (!boundCounselorFromPatient(latestPatient)) {
      showNotice("error", "该来访尚未绑定咨询师，请先在来访者详情中绑定");
      return false;
    }

    const nextDraft = INITIAL_DRAFT();
    slotRequestSeq.current += 1;
    setSlotLoading(false);
    setSlotError(null);
    setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
    setDraft(nextDraft);
    void loadSlots(nextDraft, latestPatient);
    return true;
  }, [loadSlots, refreshPatientContract, showNotice]);

  const closeCreate = useCallback(() => {
    slotRequestSeq.current += 1;
    setSlotLoading(false);
    setSlotError(null);
    setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
    setDraft(INITIAL_DRAFT());
  }, []);

  const submitProxyOrder = useCallback(
    async (slot: ProxySlotOption, roomId: string) => {
      const selectedPatient = patientRef.current;
      const selectedCounselor = counselorRef.current;
      if (!selectedPatient || !selectedCounselor) {
        showNotice("error", "请先选择来访者和咨询师");
        return undefined;
      }
      clearNotice();
      setSlotError(null);
      try {
        const latestPatient = await refreshPatientContract(selectedPatient, true);
        if (!latestPatient) {
          return undefined;
        }
        const latestCounselor = boundCounselorFromPatient(latestPatient);
        if (!latestCounselor) {
          const message = "该来访尚未绑定咨询师，不能推送订单";
          setSlotError(message);
          showNotice("error", message);
          return undefined;
        }
        if (latestCounselor.id !== selectedCounselor.id) {
          const message = "来访绑定咨询师已变更，请重新选择时段";
          setSlotError(message);
          showNotice("error", message);
          setData((prev) => ({ ...prev, proxySlotOptions: undefined }));
          setDraft((prev) => ({ ...prev, slotKey: "", roomId: "" }));
          return undefined;
        }
        if (!latestPatient.isContractSigned && draft.agreementIsAdult === null) {
          const message = "该来访当前未签约，请先选择需要推送的签约协议";
          setSlotError(message);
          showNotice("error", message);
          return undefined;
        }

        const result = await pushProxyOrder({
          patientId: latestPatient.id,
          counselorId: latestCounselor.id,
          centerId: draft.centerId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomId: roomId || undefined,
          scheduleId: slot.existingAvailableScheduleId || slot.counselorScheduleId || undefined,
          agreementIsAdult: latestPatient.isContractSigned
            ? undefined
            : draft.agreementIsAdult === null
              ? undefined
              : draft.agreementIsAdult,
        });
        const successText = proxyOrderSuccessText(result);
        showNotice("success", successText);
        void loadCalendar(activeQuery, latestCounselor, {
          clearExistingNotice: false,
          notifyOnError: false,
        }).then((refreshResult) => {
          if (refreshResult === "error") {
            showNotice("info", `${successText}，但排期刷新失败，请手动刷新后核对`);
          }
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "代理预约订单推送失败";
        setSlotError(message);
        showNotice("error", message);
        return undefined;
      }
    },
    [activeQuery, clearNotice, draft.agreementIsAdult, draft.centerId, loadCalendar, refreshPatientContract, showNotice],
  );

  const refreshCurrentPatient = useCallback(
    () => refreshPatientContract(patientRef.current, true),
    [refreshPatientContract],
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
      patientStatusError={patientStatusError}
      patientStatusLoading={patientStatusLoading}
      query={draftQuery}
      setDraft={setDraft}
      setPatient={setPatient}
      setQuery={setDraftQuery}
      slotError={slotError}
      slotLoading={slotLoading}
      slotOptions={data.proxySlotOptions}
      onCloseCreate={closeCreate}
      onLoadSlots={loadSlots}
      onOpenCreate={prepareCreate}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onPushOrder={submitProxyOrder}
      onReset={reset}
      onRefreshPatient={refreshCurrentPatient}
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
  // 三个入口都只允许预填来访；即使旧链接携带 counselorId，也不能将其
  // 作为当前绑定关系。hydratePrefilledPatient 会按 patientId 重新读取权威状态。
  const id = Number(params.get("patientId"));
  if (!Number.isFinite(id) || id <= 0) {
    return undefined;
  }
  const name = params.get("patientName") || `来访#${id}`;
  const mobile = params.get("patientMobile") || undefined;
  return {
    id,
    name,
    mobile,
    label: name,
  };
}

function patientFromContractDetail(detail: Awaited<ReturnType<typeof fetchPatientContractInfo>>): ProxyPersonOption {
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
  return patient;
}
