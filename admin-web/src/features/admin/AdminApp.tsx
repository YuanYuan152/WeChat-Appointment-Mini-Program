"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clearStoredToken, fetchCurrentUser, getStoredToken, loginWithDevCode } from "@/lib/api";
import { formatMoneyFromCents, roleLabel, statusLabel } from "@/lib/format";
import type { CurrentUser, Role } from "@/types/api";

import { LoginScreen } from "./components/LoginScreen";
import { AdminShell } from "./components/AdminShell";
import { fetchCounselorBoard, fetchCounselorBoardDetail, fetchUserBoard, fetchUserBoardDetail } from "./api/boards";
import { createContent, deleteContent, fetchContentData } from "./api/content";
import { fetchDashboardData } from "./api/dashboard";
import { fetchRefundExemptions, approveRefundExemption, rejectRefundExemption } from "./api/refunds";
import { fetchCounselorRecordSummary, fetchOperationRecords } from "./api/records";
import { bindUserRole, fetchAdminUsers, unbindUserRole } from "./api/roles";
import { fetchRoomsData } from "./api/rooms";
import { fetchScheduleOverview } from "./api/schedules";
import { CaseRecordsPanel } from "./panels/CaseRecordsPanel";
import { ContentPanel } from "./panels/ContentPanel";
import { CounselorBoardPanel } from "./panels/CounselorBoardPanel";
import { DashboardPanel } from "./panels/DashboardPanel";
import { OperationLogsPanel } from "./panels/OperationLogsPanel";
import { RefundsPanel } from "./panels/RefundsPanel";
import { RolesPanel } from "./panels/RolesPanel";
import { RoomsPanel } from "./panels/RoomsPanel";
import { SchedulesPanel } from "./panels/SchedulesPanel";
import { UserBoardPanel } from "./panels/UserBoardPanel";
import type { AdminData, ContentDraft, Notice, OperationFilters, SectionId } from "./types";
import { getMessage, roleText } from "./utils";

export function AdminApp() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [data, setData] = useState<AdminData>({});
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, Role>>({});
  const [userKeyword, setUserKeyword] = useState("");
  const [counselorKeyword, setCounselorKeyword] = useState("");
  const [operationFilters, setOperationFilters] = useState<OperationFilters>({
    keyword: "",
    role: "",
    actionType: "",
  });
  const [contentDraft, setContentDraft] = useState<ContentDraft>({
    kind: "article",
    title: "",
    summary: "",
    imageUrl: "",
  });

  const isAdmin = currentUser?.roles.includes("Admin") ?? false;
  const canEnterAdmin = currentUser?.roles.some((role) => role === "Admin" || role === "Ops") ?? false;

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
  }, []);

  const loadSection = useCallback(
    async (section: SectionId) => {
      if (!currentUser) {
        return;
      }

      setLoading(true);
      setNotice(null);

      try {
        if (section === "dashboard") {
          const { dashboard, refunds, counselorRecords, roomStatus } = await fetchDashboardData();
          setData((prev) => ({ ...prev, dashboard, refunds, counselorRecords, roomStatus }));
        }

        if (section === "roles") {
          const adminUsers = await fetchAdminUsers();
          setData((prev) => ({ ...prev, adminUsers }));
        }

        if (section === "refunds") {
          const refunds = await fetchRefundExemptions("ALL");
          setData((prev) => ({ ...prev, refunds }));
        }

        if (section === "content") {
          const { banners, activities, articles } = await fetchContentData();
          setData((prev) => ({ ...prev, banners, activities, articles }));
        }

        if (section === "schedules") {
          const schedules = await fetchScheduleOverview();
          setData((prev) => ({ ...prev, schedules }));
        }

        if (section === "rooms") {
          const { rooms, roomStatus } = await fetchRoomsData();
          setData((prev) => ({ ...prev, rooms, roomStatus }));
        }

        if (section === "caseRecords" || section === "counselorBoard") {
          const counselorRecords = await fetchCounselorRecordSummary();
          setData((prev) => ({ ...prev, counselorRecords }));
        }

        if (section === "operationLogs") {
          const operationRecords = await fetchOperationRecords(operationFilters);
          setData((prev) => ({ ...prev, operationRecords }));
        }

        if (section === "userBoard") {
          const userBoard = await fetchUserBoard(userKeyword);
          setData((prev) => ({ ...prev, userBoard }));
        }

        if (section === "counselorBoard") {
          const counselorBoard = await fetchCounselorBoard(counselorKeyword);
          setData((prev) => ({ ...prev, counselorBoard }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "加载失败";
        showNotice("error", message);
      } finally {
        setLoading(false);
      }
    },
    [counselorKeyword, currentUser, operationFilters, showNotice, userKeyword],
  );

  useEffect(() => {
    async function boot() {
      const token = getStoredToken();
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const me = await fetchCurrentUser();
        setCurrentUser(me);
      } catch {
        clearStoredToken();
      } finally {
        setBooting(false);
      }
    }
    void boot();
  }, []);

  useEffect(() => {
    if (currentUser && canEnterAdmin) {
      void loadSection(activeSection);
    }
  }, [activeSection, canEnterAdmin, currentUser, loadSection]);

  const handleLogin = async (code: "dev_admin" | "dev_ops") => {
    setLoading(true);
    setNotice(null);
    try {
      await loginWithDevCode(code);
      const me = await fetchCurrentUser();
      setCurrentUser(me);
      setActiveSection("dashboard");
      showNotice("success", `已进入${roleLabel(me.activeRole)}开发账号`);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
    setData({});
    setNotice(null);
  };

  const runAction = async (action: () => Promise<unknown>, successFallback: string) => {
    setLoading(true);
    try {
      const result = await action();
      showNotice("success", getMessage(result, successFallback));
      await loadSection(activeSection);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  const openUserDetail = async (accountId: number) => {
    setLoading(true);
    try {
      const selectedUserBoard = await fetchUserBoardDetail(accountId);
      setData((prev) => ({ ...prev, selectedUserBoard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户详情加载失败");
    } finally {
      setLoading(false);
    }
  };

  const openCounselorDetail = async (accountId: number) => {
    setLoading(true);
    try {
      const selectedCounselorBoard = await fetchCounselorBoardDetail(accountId);
      setData((prev) => ({ ...prev, selectedCounselorBoard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询师详情加载失败");
    } finally {
      setLoading(false);
    }
  };

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

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] text-[var(--lxxl-text)]">
        <div className="rounded-2xl border border-[var(--lxxl-border)] bg-white px-8 py-6 text-sm text-[var(--lxxl-muted)]">
          正在恢复登录状态...
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen loading={loading} notice={notice} onLogin={handleLogin} />;
  }

  if (!canEnterAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
        <section className="w-full max-w-lg rounded-2xl border border-[var(--lxxl-border)] bg-white p-8">
          <h1 className="text-xl font-semibold">无法进入 Web 管理端</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
            当前账号是 {roleText(currentUser.roles)}，Web 第一版只开放管理员和运营角色。
          </p>
          <button
            className="mt-6 rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white"
            type="button"
            onClick={handleLogout}
          >
            退出
          </button>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      activeSection={activeSection}
      currentUser={currentUser}
      isAdmin={isAdmin}
      loading={loading}
      notice={notice}
      onChangeSection={setActiveSection}
      onLogout={handleLogout}
      onRefresh={() => loadSection(activeSection)}
    >
      {activeSection === "dashboard" && <DashboardPanel data={data} summaryRows={summaryRows} />}
      {activeSection === "roles" && (
        <RolesPanel
          users={data.adminUsers}
          roleDrafts={roleDrafts}
          setRoleDrafts={setRoleDrafts}
          onBindRole={(userId, role) =>
            runAction(
              () => bindUserRole(userId, role),
              "角色已绑定",
            )
          }
          onUnbindRole={(userId, role) =>
            runAction(
              () => unbindUserRole(userId, role),
              "角色已解绑",
            )
          }
        />
      )}
      {activeSection === "refunds" && (
        <RefundsPanel
          refunds={data.refunds}
          onApprove={(id) =>
            runAction(
              () => approveRefundExemption(id),
              "已通过豁免申请",
            )
          }
          onReject={(id) => {
            const reason = window.prompt("请输入拒绝原因");
            if (!reason) {
              return;
            }
            void runAction(
              () => rejectRefundExemption(id, reason),
              "已拒绝豁免申请",
            );
          }}
        />
      )}
      {activeSection === "content" && (
        <ContentPanel
          data={data}
          draft={contentDraft}
          setDraft={setContentDraft}
          onCreate={() =>
            runAction(() => createContent(contentDraft), "内容已新增")
          }
          onDelete={(kind, id) =>
            runAction(() => deleteContent(kind, id), "内容已删除")
          }
        />
      )}
      {activeSection === "schedules" && <SchedulesPanel schedules={data.schedules} />}
      {activeSection === "rooms" && <RoomsPanel rooms={data.rooms} roomStatus={data.roomStatus} />}
      {activeSection === "caseRecords" && <CaseRecordsPanel records={data.counselorRecords} />}
      {activeSection === "operationLogs" && (
        <OperationLogsPanel
          records={data.operationRecords}
          filters={operationFilters}
          setFilters={setOperationFilters}
          onSearch={() => loadSection("operationLogs")}
        />
      )}
      {activeSection === "userBoard" && (
        <UserBoardPanel
          users={data.userBoard}
          selected={data.selectedUserBoard}
          keyword={userKeyword}
          setKeyword={setUserKeyword}
          onSearch={() => loadSection("userBoard")}
          onOpen={openUserDetail}
        />
      )}
      {activeSection === "counselorBoard" && (
        <CounselorBoardPanel
          records={data.counselorBoard}
          selected={data.selectedCounselorBoard}
          keyword={counselorKeyword}
          setKeyword={setCounselorKeyword}
          onSearch={() => loadSection("counselorBoard")}
          onOpen={openCounselorDetail}
        />
      )}
    </AdminShell>
  );
}
