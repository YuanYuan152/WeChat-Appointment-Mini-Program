import { memo, useState } from "react";

import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type {
  AdminCounselorIntroProfile,
  AdminCounselorIntroUpdatePayload,
  CounselorBoardDetail,
  CounselorBoardSummary,
  PagedResult,
} from "@/types/api";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import { StaffRemarkEditor } from "@/components/boards/StaffRemarkEditor";
import { CounselorDisplayOrderSection } from "@/components/counselors/CounselorDisplayOrderSection";
import { CounselorIntroEditor } from "@/components/counselors/CounselorIntroEditor";
import type { CounselorBoardFilters } from "@/services/boards";
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

export function CounselorBoardPanel({
  records,
  listLoading,
  selected,
  detailLoading,
  keyword,
  setKeyword,
  visibility,
  setVisibility,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onCloseDetail,
  canEditIntro,
  introProfile,
  introLoading,
  introSaving,
  introError,
  onOpenIntroEditor,
  onCloseIntroEditor,
  onSaveIntro,
  remarkSaving,
  onSaveRemark,
  onNotice,
}: {
  records?: PagedResult<CounselorBoardSummary>;
  listLoading: boolean;
  selected?: CounselorBoardDetail;
  detailLoading: boolean;
  keyword: string;
  setKeyword: (value: string) => void;
  visibility: CounselorBoardFilters["visibility"];
  setVisibility: (value: CounselorBoardFilters["visibility"]) => void;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
  onCloseDetail: () => void;
  canEditIntro: boolean;
  introProfile?: AdminCounselorIntroProfile;
  introLoading: boolean;
  introSaving: boolean;
  introError: string | null;
  onOpenIntroEditor: (accountId: number) => void;
  onCloseIntroEditor: () => void;
  onSaveIntro: (payload: AdminCounselorIntroUpdatePayload) => Promise<void>;
  remarkSaving: boolean;
  onSaveRemark: (accountId: number, remark: string) => Promise<string>;
  onNotice: (tone: "success" | "error", message: string) => void;
}) {
  return (
    <div className="space-y-5">
      <CounselorDisplayOrderSection enabled={canEditIntro} onNotice={onNotice} />
      <CounselorBoardListSection
        keyword={keyword}
        listLoading={listLoading}
        onOpen={onOpen}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onReset={onReset}
        onSearch={onSearch}
        canEditIntro={canEditIntro}
        onOpenIntroEditor={onOpenIntroEditor}
        records={records}
        setKeyword={setKeyword}
        visibility={visibility}
        setVisibility={setVisibility}
      />
      {(detailLoading || selected) && (
        <DetailDrawer title="咨询师详情" onClose={onCloseDetail}>
          {detailLoading && !selected ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
          ) : selected ? (
            <CounselorDetailPanel
              canEditIntro={canEditIntro}
              detail={selected}
              onEditIntro={() => onOpenIntroEditor(selected.profile.id)}
              remarkSaving={remarkSaving}
              onSaveRemark={onSaveRemark}
            />
          ) : null}
        </DetailDrawer>
      )}
      {(introLoading || introProfile || introError) && (
        <DetailDrawer
          closeDisabled={introSaving}
          footer={null}
          title="编辑咨询师介绍页"
          onClose={onCloseIntroEditor}
        >
          {introLoading && !introProfile ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载介绍页资料...</div>
          ) : introError ? (
            <div className="space-y-4 py-6 text-sm">
              <div className="text-[#A13F37]">{introError}</div>
              <TableActionButton onClick={onCloseIntroEditor}>关闭</TableActionButton>
            </div>
          ) : introProfile ? (
            <CounselorIntroEditor
              profile={introProfile}
              saving={introSaving}
              onCancel={onCloseIntroEditor}
              onSave={onSaveIntro}
            />
          ) : null}
        </DetailDrawer>
      )}
    </div>
  );
}

const CounselorBoardListSection = memo(function CounselorBoardListSection({
  records,
  listLoading,
  keyword,
  setKeyword,
  visibility,
  setVisibility,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
  canEditIntro,
  onOpenIntroEditor,
}: {
  records?: PagedResult<CounselorBoardSummary>;
  listLoading: boolean;
  keyword: string;
  setKeyword: (value: string) => void;
  visibility: CounselorBoardFilters["visibility"];
  setVisibility: (value: CounselorBoardFilters["visibility"]) => void;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
  canEditIntro: boolean;
  onOpenIntroEditor: (accountId: number) => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal">咨询师管理</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            查看咨询师资料、咨询单、记录填写和请假申请，并维护内部备注。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="姓名/电话">
            <input
              className={queryControlClass}
              placeholder="请输入"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </QueryField>
          <QueryField label="展示状态">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={visibility ?? ""}
              onChange={(event) =>
                setVisibility(event.target.value as CounselorBoardFilters["visibility"])
              }
            >
              <option value="">全部</option>
              <option value="visible">展示中</option>
              <option value="hidden">已隐藏</option>
            </select>
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="border-t border-[var(--lxxl-border)] bg-[#FCFBF8] px-6 py-3 text-xs leading-5 text-[var(--lxxl-muted)] sm:px-7 lg:px-8">
        <span className="font-medium text-[var(--lxxl-text)]">统计口径：</span>
        咨询单包含全部状态；取消咨询暂不区分取消方；记录待补仅统计已完成但尚无记录的咨询；请假申请包含全部审核状态。
      </div>
      <div className="relative">
        {listLoading && records && records.items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!records || records.items.length === 0 ? (
        <EmptyState text={listLoading ? "正在加载列表..." : "暂无咨询师数据。"} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">咨询师</th>
                  <th className="px-5 py-3 font-medium">联系电话</th>
                  <MetricTableHeader hint="总数 / 已完成" title="咨询单" />
                  <MetricTableHeader hint="取消来源未区分" title="取消咨询" />
                  <MetricTableHeader hint="已有 / 待补" title="记录完成情况" />
                  <MetricTableHeader hint="全部申请状态" title="请假申请" />
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.items.map((record) => {
                  const hidden = record.isPublicVisible === false;
                  return (
                  <tr
                    key={record.id}
                    className={`border-t border-[var(--lxxl-border)] transition ${
                      hidden
                        ? "bg-[#F0EFEC] text-[#9A9690]"
                        : "hover:bg-[#FAF8F4]"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={`truncate font-semibold ${hidden ? "text-[#9A9690]" : ""}`}
                          title={record.name}
                        >
                          {record.name}
                        </div>
                        {hidden ? <Badge tone="neutral">已隐藏</Badge> : null}
                      </div>
                      {record.staffRemark && (
                        <div
                          className={`mt-1 truncate text-xs font-normal ${
                            hidden ? "text-[#B0ACA6]" : "text-[#8A6438]"
                          }`}
                          title={`内部备注：${record.staffRemark}`}
                        >
                          内部备注：{record.staffRemark}
                        </div>
                      )}
                    </td>
                    <td className={`px-5 py-4 ${hidden ? "text-[#B0ACA6]" : "text-[var(--lxxl-muted)]"}`}>
                      <div className="truncate" title={record.mobile || "-"}>
                        {record.mobile || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <RatioMetric
                        muted={hidden}
                        part={record.completedConsultationCount}
                        partLabel="已完成"
                        total={record.consultationCount}
                        totalLabel="总计"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <SingleMetric hint="取消来源未区分" muted={hidden} value={record.cancelledConsultationCount} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <div className={`text-xs ${hidden ? "text-[#B0ACA6]" : "text-[var(--lxxl-muted)]"}`}>
                          已有{" "}
                          <span className={`text-base font-semibold ${hidden ? "text-[#9A9690]" : "text-[var(--lxxl-text)]"}`}>
                            {record.caseRecordCount}
                          </span>
                        </div>
                        <Badge tone={record.missingRecordCount > 0 ? "gold" : "green"}>
                          待补 {record.missingRecordCount}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SingleMetric hint="累计申请" muted={hidden} value={record.leaveRequestCount} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                        {canEditIntro && (
                          <TableActionButton onClick={() => onOpenIntroEditor(record.id)}>
                            编辑介绍页
                          </TableActionButton>
                        )}
                        <TableActionButton onClick={() => onOpen(record.id)}>
                          查看
                        </TableActionButton>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={records.page}
            pageSize={records.pageSize}
            total={records.total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
      </div>
    </section>
  );
});

function MetricTableHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <th className="px-5 py-3">
      <div className="font-medium text-[var(--lxxl-text)]">{title}</div>
      <div className="mt-1 text-[11px] font-normal text-[var(--lxxl-muted)]">{hint}</div>
    </th>
  );
}

function RatioMetric({
  total,
  totalLabel,
  part,
  partLabel,
  muted = false,
}: {
  total: number;
  totalLabel: string;
  part: number;
  partLabel: string;
  muted?: boolean;
}) {
  const ratio = total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-base font-semibold ${muted ? "text-[#9A9690]" : "text-[var(--lxxl-text)]"}`}>{total}</span>
        <span className={`text-xs ${muted ? "text-[#B0ACA6]" : "text-[var(--lxxl-muted)]"}`}>{totalLabel}</span>
      </div>
      <div className={`mt-1 text-xs ${muted ? "text-[#B0ACA6]" : "text-[var(--lxxl-muted)]"}`}>
        {partLabel}{" "}
        <span className={`font-medium ${muted ? "text-[#9A9690]" : "text-[var(--lxxl-text)]"}`}>{part}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDE9E2]">
        <div className="h-full rounded-full bg-[var(--lxxl-green)]" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function SingleMetric({ value, hint, muted = false }: { value: number; hint: string; muted?: boolean }) {
  return (
    <div>
      <div className={`text-base font-semibold ${muted ? "text-[#9A9690]" : "text-[var(--lxxl-text)]"}`}>{value}</div>
      <div className={`mt-1 text-xs ${muted ? "text-[#B0ACA6]" : "text-[var(--lxxl-muted)]"}`}>{hint}</div>
    </div>
  );
}

function compactMeta(parts: Array<string | null | undefined>) {
  const visibleParts = parts.filter((part): part is string => Boolean(part && part !== "-"));
  return visibleParts.length > 0 ? visibleParts.join(" · ") : "-";
}

function timeRangeLabel(startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) {
    return "时间未定";
  }
  return `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`;
}

function placeLabel(centerName?: string | null, roomName?: string | null) {
  return compactMeta([centerName, roomName]);
}

function patientLabel(patientName?: string | null, patientMobile?: string | null, patientContractTag?: string | null) {
  const name = patientName || "来访者未填";
  const contact = patientMobile ? `${name}（${patientMobile}）` : name;
  return patientContractTag ? `${contact} ${patientContractTag}` : contact;
}

function CounselorDetailPanel({
  detail,
  canEditIntro,
  onEditIntro,
  remarkSaving,
  onSaveRemark,
}: {
  detail: CounselorBoardDetail;
  canEditIntro: boolean;
  onEditIntro: () => void;
  remarkSaving: boolean;
  onSaveRemark: (accountId: number, remark: string) => Promise<string>;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const visitors = detail.visitors ?? [];
  const cancelledConsultations = detail.consultations.filter(
    (item) => item.status === "CANCELLED" || item.status === "CANCELED",
  );
  const visitorItems = visitors.map((item) => {
    const latestAppointment = item.latestAppointment;
    const latestLabel = latestAppointment
      ? compactMeta([
          timeRangeLabel(latestAppointment.startTime, latestAppointment.endTime),
          statusLabel(latestAppointment.status),
          placeLabel(latestAppointment.centerName, latestAppointment.roomName),
        ])
      : "-";

    return {
      label: compactMeta([
        patientLabel(item.patientName, item.patientMobile, item.patientContractTag),
        `咨询 ${item.consultationCount} 次`,
      ]),
      detail: [
        `来访者：${patientLabel(item.patientName, item.patientMobile, item.patientContractTag)}`,
        `咨询次数：${item.consultationCount}`,
        `总预约次数：${item.appointmentCount}`,
        `取消次数：${item.cancelledCount}`,
        `付款金额：${formatMoneyFromCents(item.paidAmount)}`,
        `最近预约：${latestLabel}`,
        latestAppointment?.note ? `备注：${latestAppointment.note}` : "备注：-",
      ],
    };
  });
  const consultationItems = detail.consultations.map((item) => ({
    label: compactMeta([patientLabel(item.patientName, item.patientMobile, item.patientContractTag), timeRangeLabel(item.startTime, item.endTime), statusLabel(item.status)]),
    detail: [
      `来访者：${patientLabel(item.patientName, item.patientMobile, item.patientContractTag)}`,
      `状态：${statusLabel(item.status)}`,
      `咨询时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询地点：${placeLabel(item.centerName, item.roomName)}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const cancelledConsultationItems = cancelledConsultations.map((item) => ({
    label: compactMeta(["取消咨询", patientLabel(item.patientName, item.patientMobile, item.patientContractTag), timeRangeLabel(item.startTime, item.endTime)]),
    detail: [
      `来访者：${patientLabel(item.patientName, item.patientMobile, item.patientContractTag)}`,
      `状态：${statusLabel(item.status)}`,
      `咨询时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询地点：${placeLabel(item.centerName, item.roomName)}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const caseRecordItems = detail.caseRecords.map((item) => ({
    label: compactMeta([
      patientLabel(item.patientName, item.patientMobile, item.patientContractTag),
      timeRangeLabel(item.startTime, item.endTime),
      item.updatedAt ? `更新 ${formatDateTime(item.updatedAt)}` : "未更新",
    ]),
    detail: [
      `来访者：${patientLabel(item.patientName, item.patientMobile, item.patientContractTag)}`,
      `咨询状态：${statusLabel(item.status)}`,
      `咨询时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询地点：${placeLabel(item.centerName, item.roomName)}`,
      `创建时间：${formatDateTime(item.createdAt)}`,
      `更新时间：${formatDateTime(item.updatedAt)}`,
      item.preview ? `摘要：${item.preview}` : "摘要：-",
    ],
  }));
  const leaveItems = detail.leaveRequests.map((item) => ({
    label: compactMeta(["请假", timeRangeLabel(item.startTime, item.endTime), statusLabel(item.status)]),
    detail: [
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : "-"}`,
      `排期时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `排期地点：${placeLabel(item.centerName, item.roomName)}`,
      `提交时间：${formatDateTime(item.createdAt)}`,
      `更新时间：${formatDateTime(item.updatedAt)}`,
      `状态：${statusLabel(item.status)}`,
      `原因：${item.reason}`,
    ],
  }));
  const scheduleItems = detail.schedules.map((item) => ({
    label: compactMeta([
      "排期",
      timeRangeLabel(item.startTime, item.endTime),
      item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : null,
      statusLabel(item.status),
    ]),
    detail: [
      `状态：${statusLabel(item.status)}`,
      `排期时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `排期地点：${placeLabel(item.centerName, item.roomName)}`,
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : "-"}`,
    ],
  }));
  const roomUsageItems = detail.roomUsage.map((item) => ({
    label: compactMeta([
      timeRangeLabel(item.startTime, item.endTime),
      placeLabel(item.centerName, item.roomName),
      item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : null,
    ]),
    detail: [
      `状态：${statusLabel(item.status)}`,
      `使用时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询室：${placeLabel(item.centerName, item.roomName)}`,
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : "-"}`,
    ],
  }));
  const cancelLogItems = detail.scheduleCancelLogs.map((item) => ({
    label: compactMeta([
      "取消排期",
      item.startTime || item.endTime ? timeRangeLabel(item.startTime, item.endTime) : formatDateTime(item.createdAt),
      item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : null,
    ]),
    detail: [
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile, item.patientContractTag) : "-"}`,
      `排期时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `排期地点：${placeLabel(item.centerName, item.roomName)}`,
      `提交时间：${formatDateTime(item.createdAt)}`,
      `沟通截图：${item.screenshotUrl || "-"}`,
    ],
  }));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-[var(--lxxl-muted)]">咨询师详情</div>
          <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
          <div className="mt-1 text-sm text-[var(--lxxl-muted)]">{detail.profile.mobile || "-"}</div>
        </div>
        {canEditIntro && <TableActionButton onClick={onEditIntro}>编辑介绍页</TableActionButton>}
      </div>
      <StaffRemarkEditor
        accountId={detail.profile.id}
        saving={remarkSaving}
        value={detail.profile.staffRemark}
        onSave={(remark) => onSaveRemark(detail.profile.id, remark)}
      />
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="咨询单总数" value={detail.profile.consultationCount} />
        <MiniStat label="已完成咨询" value={detail.profile.completedConsultationCount} />
        <MiniStat label="已取消咨询" value={detail.profile.cancelledConsultationCount} />
        <MiniStat label="待补记录" value={detail.profile.missingRecordCount} />
        <MiniStat label="已有咨询记录" value={detail.profile.caseRecordCount} />
        <MiniStat label="请假申请" value={detail.profile.leaveRequestCount} />
        <MiniStat label="排期总数" value={detail.profile.scheduleCount} />
        <MiniStat label="已占用排期" value={detail.profile.bookedScheduleCount} />
        <MiniStat label="咨询室使用" value={detail.roomUsage.length} />
        <MiniStat label="来访人数" value={visitors.length} />
      </div>
      <ClickableDetailList
        expandedKey={expandedKey}
        items={visitorItems}
        listKey={`counselor-${detail.profile.id}-visitors`}
        onToggle={setExpandedKey}
        title="来访者"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={consultationItems}
        listKey={`counselor-${detail.profile.id}-consultations`}
        onToggle={setExpandedKey}
        title="咨询明细"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={caseRecordItems}
        listKey={`counselor-${detail.profile.id}-case-records`}
        onToggle={setExpandedKey}
        title="咨询记录"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={cancelledConsultationItems}
        listKey={`counselor-${detail.profile.id}-cancelled-consultations`}
        onToggle={setExpandedKey}
        title="取消咨询记录（全部来源）"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={cancelLogItems}
        listKey={`counselor-${detail.profile.id}-cancel-logs`}
        onToggle={setExpandedKey}
        title="取消排期记录"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={leaveItems}
        listKey={`counselor-${detail.profile.id}-leave-requests`}
        onToggle={setExpandedKey}
        title="请假申请记录"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={scheduleItems}
        listKey={`counselor-${detail.profile.id}-schedules`}
        onToggle={setExpandedKey}
        title="排期记录"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={roomUsageItems}
        listKey={`counselor-${detail.profile.id}-room-usage`}
        onToggle={setExpandedKey}
        title="使用咨询室记录"
      />
    </>
  );
}

function ClickableDetailList({
  title,
  items,
  listKey,
  expandedKey,
  onToggle,
}: {
  title: string;
  items: Array<{ label: string; detail: string[] }>;
  listKey: string;
  expandedKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  return (
    <CollapsibleSection
      count={items.length}
      title={title}
      onOpenChange={(open) => {
        if (!open && expandedKey?.startsWith(`${listKey}-`)) {
          onToggle(null);
        }
      }}
    >
      {items.length === 0 ? (
        <div className="text-sm text-[var(--lxxl-muted)]">暂无记录</div>
      ) : (
        <div className="divide-y divide-[var(--lxxl-border)] border-y border-[var(--lxxl-border)]">
          {items.map((item, index) => {
            const itemKey = `${listKey}-${index}`;
            const expanded = expandedKey === itemKey;

            return (
              <div key={itemKey}>
                <button
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-xs leading-5 text-[var(--lxxl-muted)] transition hover:text-[var(--lxxl-text)]"
                  type="button"
                  onClick={() => onToggle(expanded ? null : itemKey)}
                >
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                    {expanded ? "收起" : "展开"}
                  </span>
                </button>
                {expanded && (
                  <div className="pb-4 text-xs leading-6 text-[var(--lxxl-muted)]">
                    <div className="mb-1 font-medium text-[var(--lxxl-text)]">记录详情</div>
                    {item.detail.map((line, detailIndex) => (
                      <div key={`${itemKey}-detail-${detailIndex}`}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
