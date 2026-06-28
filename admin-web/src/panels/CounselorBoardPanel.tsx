import { memo, useState } from "react";

import { formatDateTime, statusLabel } from "@/lib/format";
import type { CounselorBoardDetail, CounselorBoardSummary, PagedResult } from "@/types/api";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  Badge,
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
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">ID {record.id}</div>
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

function CounselorDetailPanel({ detail }: { detail: CounselorBoardDetail }) {
  const cancelledConsultations = detail.consultations.filter(
    (item) => item.status === "CANCELLED" || item.status === "CANCELED",
  );
  const consultationItems = detail.consultations.map((item) => ({
    label: `咨询 #${item.id} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
      item.patientName
    } · ${statusLabel(item.status)}`,
    detail: [
      `咨询ID：${item.id}`,
      `订单ID：${item.orderId || "-"}`,
      `排期ID：${item.scheduleId || "-"}`,
      `来访者：${item.patientName}${item.patientMobile ? `（${item.patientMobile}）` : ""}`,
      `状态：${statusLabel(item.status)}`,
      `时间：${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)}`,
      `地点：${item.centerName || "-"} ${item.roomName || ""}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const cancelledConsultationItems = cancelledConsultations.map((item) => ({
    label: `取消咨询 #${item.id} · ${formatDateTime(item.startTime)} · ${item.patientName}`,
    detail: [
      `咨询ID：${item.id}`,
      `订单ID：${item.orderId || "-"}`,
      `排期ID：${item.scheduleId || "-"}`,
      `来访者：${item.patientName}${item.patientMobile ? `（${item.patientMobile}）` : ""}`,
      `状态：${statusLabel(item.status)}`,
      `时间：${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)}`,
      `地点：${item.centerName || "-"} ${item.roomName || ""}`,
      `咨询记录：${item.hasCaseRecord ? "已填写" : "未填写"}`,
      item.note ? `备注：${item.note}` : "备注：-",
    ],
  }));
  const caseRecordItems = detail.caseRecords.map((item) => ({
    label: `记录 #${item.id} · 咨询 #${item.consultationId} · 更新 ${formatDateTime(item.updatedAt)}`,
    detail: [
      `记录ID：${item.id}`,
      `咨询ID：${item.consultationId}`,
      `创建时间：${formatDateTime(item.createdAt)}`,
      `更新时间：${formatDateTime(item.updatedAt)}`,
      item.preview ? `摘要：${item.preview}` : "摘要：-",
    ],
  }));
  const leaveItems = detail.leaveRequests.map((item) => ({
    label: `请假 #${item.id} · 排期 #${item.scheduleId} · ${statusLabel(item.status)}`,
    detail: [
      `请假ID：${item.id}`,
      `排期ID：${item.scheduleId}`,
      `提交时间：${formatDateTime(item.createdAt)}`,
      `更新时间：${formatDateTime(item.updatedAt)}`,
      `状态：${statusLabel(item.status)}`,
      `原因：${item.reason}`,
    ],
  }));
  const scheduleItems = detail.schedules.map((item) => ({
    label: `排期 #${item.id} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${statusLabel(item.status)}`,
    detail: [
      `排期ID：${item.id}`,
      `状态：${statusLabel(item.status)}`,
      `时间：${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)}`,
      `地点：${item.centerName || "-"} ${item.roomName || ""}`,
    ],
  }));
  const roomUsageItems = detail.roomUsage.map((item) => ({
    label: `排期 #${item.scheduleId} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
      item.centerName || "-"
    } ${item.roomName || ""}`,
    detail: [
      `排期ID：${item.scheduleId}`,
      `状态：${statusLabel(item.status)}`,
      `时间：${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)}`,
      `咨询室：${item.centerName || "-"} ${item.roomName || ""}`,
    ],
  }));
  const cancelLogItems = detail.scheduleCancelLogs.map((item) => ({
    label: `取消 #${item.id} · 排期 #${item.scheduleId} · ${formatDateTime(item.createdAt)}`,
    detail: [
      `取消记录ID：${item.id}`,
      `排期ID：${item.scheduleId}`,
      `咨询ID：${item.consultationId || "-"}`,
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
      <ClickableDetailList title="咨询明细" items={consultationItems} />
      <ClickableDetailList title="咨询记录" items={caseRecordItems} />
      <ClickableDetailList title="来访取消记录" items={cancelledConsultationItems} />
      <ClickableDetailList title="咨询师取消/请假取消日志" items={cancelLogItems} />
      <ClickableDetailList title="请假记录" items={leaveItems} />
      <ClickableDetailList title="排期记录" items={scheduleItems} />
      <ClickableDetailList title="使用咨询室记录" items={roomUsageItems} />
    </>
  );
}

function ClickableDetailList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; detail: string[] }>;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex == null ? null : items[selectedIndex];

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--lxxl-muted)]">暂无记录</div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <button
              key={`${title}-${index}`}
              className="block w-full rounded-xl bg-[#FAF8F4] p-3 text-left text-xs leading-5 text-[var(--lxxl-muted)] transition hover:bg-[#F4F1EB] hover:text-[var(--lxxl-text)]"
              type="button"
              onClick={() => setSelectedIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="mt-3 rounded-xl border border-[var(--lxxl-border)] bg-white p-3 text-xs leading-6 text-[var(--lxxl-muted)]">
          <div className="mb-1 font-medium text-[var(--lxxl-text)]">记录详情</div>
          {selected.detail.map((line, index) => (
            <div key={`${title}-detail-${index}`}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
