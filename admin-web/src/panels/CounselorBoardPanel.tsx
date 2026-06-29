import { memo, useState } from "react";

import { formatDateTime, statusLabel } from "@/lib/format";
import type { CounselorBoardDetail, CounselorBoardSummary, PagedResult } from "@/types/api";

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

export function CounselorBoardPanel({
  records,
  listLoading,
  selected,
  detailLoading,
  keyword,
  setKeyword,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onCloseDetail,
}: {
  records?: PagedResult<CounselorBoardSummary>;
  listLoading: boolean;
  selected?: CounselorBoardDetail;
  detailLoading: boolean;
  keyword: string;
  setKeyword: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <CounselorBoardListSection
        keyword={keyword}
        listLoading={listLoading}
        onOpen={onOpen}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onReset={onReset}
        onSearch={onSearch}
        records={records}
        setKeyword={setKeyword}
      />
      {(detailLoading || selected) && (
        <DetailDrawer title="咨询师详情" onClose={onCloseDetail}>
          {detailLoading && !selected ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
          ) : selected ? (
            <CounselorDetailPanel detail={selected} />
          ) : null}
        </DetailDrawer>
      )}
    </>
  );
}

const CounselorBoardListSection = memo(function CounselorBoardListSection({
  records,
  listLoading,
  keyword,
  setKeyword,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
}: {
  records?: PagedResult<CounselorBoardSummary>;
  listLoading: boolean;
  keyword: string;
  setKeyword: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
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
          <h2 className="text-xl font-semibold tracking-normal">咨询师看板</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            聚合咨询记录、请假、排班、咨询室使用记录。
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
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
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
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">咨询师</th>
                  <th className="px-5 py-3 font-medium">联系电话</th>
                  <th className="px-5 py-3 font-medium">咨询</th>
                  <th className="px-5 py-3 font-medium">来访取消</th>
                  <th className="px-5 py-3 font-medium">咨询记录</th>
                  <th className="px-5 py-3 font-medium">请假</th>
                  <th className="px-5 py-3 font-medium">排班</th>
                  <th className="px-5 py-3 font-medium">最近排班</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.items.map((record) => (
                  <tr
                    key={record.id}
                    className="border-t border-[var(--lxxl-border)] transition hover:bg-[#FAF8F4]"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold">{record.name}</div>
                    </td>
                    <td className="px-5 py-4 text-[var(--lxxl-muted)]">{record.mobile || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold">{record.consultationCount}</div>
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                        完成 {record.completedConsultationCount}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold">{record.cancelledConsultationCount}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{record.caseRecordCount}</span>
                        <Badge tone={record.missingRecordCount > 0 ? "gold" : "green"}>
                          待补记录 {record.missingRecordCount}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold">{record.leaveRequestCount}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold">{record.scheduleCount}</div>
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                        已预约 {record.bookedScheduleCount}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                      {record.latestScheduleAt ? formatDateTime(record.latestScheduleAt) : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <TableActionButton onClick={() => onOpen(record.id)}>
                        查看
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
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

function patientLabel(patientName?: string | null, patientMobile?: string | null) {
  const name = patientName || "来访者未填";
  return patientMobile ? `${name}（${patientMobile}）` : name;
}

function CounselorDetailPanel({ detail }: { detail: CounselorBoardDetail }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const cancelledConsultations = detail.consultations.filter(
    (item) => item.status === "CANCELLED" || item.status === "CANCELED",
  );
  const consultationItems = detail.consultations.map((item) => ({
    label: compactMeta([patientLabel(item.patientName, item.patientMobile), timeRangeLabel(item.startTime, item.endTime), statusLabel(item.status)]),
    detail: [
      `来访者：${item.patientName}${item.patientMobile ? `（${item.patientMobile}）` : ""}`,
      `状态：${statusLabel(item.status)}`,
      `咨询时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询地点：${placeLabel(item.centerName, item.roomName)}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const cancelledConsultationItems = cancelledConsultations.map((item) => ({
    label: compactMeta(["取消咨询", patientLabel(item.patientName, item.patientMobile), timeRangeLabel(item.startTime, item.endTime)]),
    detail: [
      `来访者：${item.patientName}${item.patientMobile ? `（${item.patientMobile}）` : ""}`,
      `状态：${statusLabel(item.status)}`,
      `咨询时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询地点：${placeLabel(item.centerName, item.roomName)}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const caseRecordItems = detail.caseRecords.map((item) => ({
    label: compactMeta([
      patientLabel(item.patientName, item.patientMobile),
      timeRangeLabel(item.startTime, item.endTime),
      item.updatedAt ? `更新 ${formatDateTime(item.updatedAt)}` : "未更新",
    ]),
    detail: [
      `来访者：${patientLabel(item.patientName, item.patientMobile)}`,
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
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile) : "-"}`,
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
      item.patientName ? patientLabel(item.patientName, item.patientMobile) : null,
      statusLabel(item.status),
    ]),
    detail: [
      `状态：${statusLabel(item.status)}`,
      `排期时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `排期地点：${placeLabel(item.centerName, item.roomName)}`,
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile) : "-"}`,
    ],
  }));
  const roomUsageItems = detail.roomUsage.map((item) => ({
    label: compactMeta([
      timeRangeLabel(item.startTime, item.endTime),
      placeLabel(item.centerName, item.roomName),
      item.patientName ? patientLabel(item.patientName, item.patientMobile) : null,
    ]),
    detail: [
      `状态：${statusLabel(item.status)}`,
      `使用时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `咨询室：${placeLabel(item.centerName, item.roomName)}`,
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile) : "-"}`,
    ],
  }));
  const cancelLogItems = detail.scheduleCancelLogs.map((item) => ({
    label: compactMeta([
      "取消排期",
      item.startTime || item.endTime ? timeRangeLabel(item.startTime, item.endTime) : formatDateTime(item.createdAt),
      item.patientName ? patientLabel(item.patientName, item.patientMobile) : null,
    ]),
    detail: [
      `关联来访：${item.patientName ? patientLabel(item.patientName, item.patientMobile) : "-"}`,
      `排期时间：${timeRangeLabel(item.startTime, item.endTime)}`,
      `排期地点：${placeLabel(item.centerName, item.roomName)}`,
      `提交时间：${formatDateTime(item.createdAt)}`,
      `沟通截图：${item.screenshotUrl || "-"}`,
    ],
  }));

  return (
    <>
      <div className="text-sm text-[var(--lxxl-muted)]">咨询师详情</div>
      <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">{detail.profile.mobile || "-"}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="咨询" value={detail.profile.consultationCount} />
        <MiniStat label="已完成" value={detail.profile.completedConsultationCount} />
        <MiniStat label="来访取消" value={detail.profile.cancelledConsultationCount} />
        <MiniStat label="待补记录" value={detail.profile.missingRecordCount} />
        <MiniStat label="个案记录" value={detail.profile.caseRecordCount} />
        <MiniStat label="请假" value={detail.profile.leaveRequestCount} />
        <MiniStat label="排期" value={detail.profile.scheduleCount} />
        <MiniStat label="已预约排班" value={detail.profile.bookedScheduleCount} />
        <MiniStat label="咨询室使用" value={detail.roomUsage.length} />
      </div>
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
        title="来访取消记录"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={cancelLogItems}
        listKey={`counselor-${detail.profile.id}-cancel-logs`}
        onToggle={setExpandedKey}
        title="咨询师取消/请假取消日志"
      />
      <ClickableDetailList
        expandedKey={expandedKey}
        items={leaveItems}
        listKey={`counselor-${detail.profile.id}-leave-requests`}
        onToggle={setExpandedKey}
        title="请假记录"
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
        <div className="space-y-2">
          {items.map((item, index) => {
            const itemKey = `${listKey}-${index}`;
            const expanded = expandedKey === itemKey;

            return (
              <div key={itemKey} className="overflow-hidden rounded-xl bg-[#FAF8F4]">
                <button
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left text-xs leading-5 text-[var(--lxxl-muted)] transition hover:bg-[#F4F1EB] hover:text-[var(--lxxl-text)]"
                  type="button"
                  onClick={() => onToggle(expanded ? null : itemKey)}
                >
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                    {expanded ? "收起" : "展开"}
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-[var(--lxxl-border)] bg-white p-3 text-xs leading-6 text-[var(--lxxl-muted)]">
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
