"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatMoneyFromCents, statusLabel } from "@/lib/format";

import { fetchDashboardData } from "@/services/dashboard";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DashboardPanel } from "@/panels/DashboardPanel";
import type { ScreenData } from "@/types/app";

export function DashboardScreen() {
  return (
    <AppRoute sectionId="dashboard">
      <DashboardScreenContent />
    </AppRoute>
  );
}

function DashboardScreenContent() {
  const { clearNotice, refreshKey, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const { dashboard, refunds, counselorRecords, roomStatus } = await fetchDashboardData();
      setData((prev) => ({ ...prev, dashboard, refunds, counselorRecords, roomStatus }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "总览加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const summaryRows = useMemo(() => {
    const pending = data.refunds?.slice(0, 4).map((item) => ({
      time: item.createdAt,
      type: "豁免审核",
      subject: `${item.patientName} / ${item.counselorName}`,
      status: statusLabel(item.status),
      amount: formatMoneyFromCents(item.amount),
    }));
    const rooms = data.roomStatus?.rooms
      ?.filter((room) => room.occupancy === "IN_SESSION")
      .slice(0, 4)
      .map((room) => ({
        time: room.startTime || room.atTime || "",
        type: "咨询室占用",
        subject: `${room.centerName} / ${room.name}`,
        status: room.patientName || statusLabel(room.occupancy),
        amount: room.counselorName || "-",
      }));

    return [...(pending || []), ...(rooms || [])].slice(0, 6);
  }, [data.refunds, data.roomStatus]);

  return <DashboardPanel data={data} summaryRows={summaryRows} />;
}
