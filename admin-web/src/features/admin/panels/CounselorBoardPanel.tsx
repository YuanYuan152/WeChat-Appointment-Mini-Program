import { formatDateTime, statusLabel } from "@/lib/format";
import type { CounselorBoardDetail, CounselorBoardSummary, PagedResult } from "@/types/api";

import { Badge, DetailList, EmptyState, MiniStat, PanelHeader } from "../components/ui";

export function CounselorBoardPanel({
  records,
  selected,
  keyword,
  setKeyword,
  onSearch,
  onOpen,
}: {
  records?: PagedResult<CounselorBoardSummary>;
  selected?: CounselorBoardDetail;
  keyword: string;
  setKeyword: (value: string) => void;
  onSearch: () => void;
  onOpen: (accountId: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_380px] gap-6">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <PanelHeader
          title="咨询师看板"
          description="聚合咨询记录、请假、排班、咨询室使用记录。"
          action={
            <div className="flex gap-2">
              <input
                className="h-10 w-64 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
                placeholder="按姓名/电话搜索"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <button
                className="rounded-xl bg-[var(--lxxl-green)] px-4 py-2 text-sm font-medium text-white"
                type="button"
                onClick={onSearch}
              >
                查询
              </button>
            </div>
          }
        />
        {!records || records.items.length === 0 ? (
          <EmptyState text="暂无咨询师数据。" />
        ) : (
          <div className="grid grid-cols-3 gap-4 p-6">
            {records.items.map((record) => (
              <button
                key={record.id}
                className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-5 text-left"
                type="button"
                onClick={() => onOpen(record.id)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{record.name}</h3>
                  <Badge tone={record.missingRecordCount > 0 ? "gold" : "green"}>缺 {record.missingRecordCount}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <MiniStat label="咨询" value={record.consultationCount} />
                  <MiniStat label="记录" value={record.caseRecordCount} />
                  <MiniStat label="请假" value={record.leaveRequestCount} />
                </div>
                <div className="mt-3 text-xs text-[var(--lxxl-muted)]">
                  挂课 {record.scheduleCount}，已预约 {record.bookedScheduleCount}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <CounselorDetailPanel detail={selected} />
    </div>
  );
}

function CounselorDetailPanel({ detail }: { detail?: CounselorBoardDetail }) {
  if (!detail) {
    return (
      <aside className="rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
        <div className="text-sm text-[var(--lxxl-muted)]">咨询师详情</div>
        <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
          点击咨询师后查看咨询、个案记录、请假、排班和咨询室使用明细。
        </p>
      </aside>
    );
  }

  return (
    <aside className="max-h-[calc(100vh-120px)] overflow-auto rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
      <div className="text-sm text-[var(--lxxl-muted)]">咨询师详情</div>
      <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">{detail.profile.mobile || "-"}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="咨询" value={detail.profile.consultationCount} />
        <MiniStat label="缺记录" value={detail.profile.missingRecordCount} />
        <MiniStat label="请假" value={detail.profile.leaveRequestCount} />
        <MiniStat label="咨询室使用" value={detail.roomUsage.length} />
      </div>
      <DetailList
        title="最近咨询"
        items={detail.consultations
          .slice(0, 8)
          .map(
            (item) =>
              `${formatDateTime(item.startTime)} · ${item.patientName} · ${statusLabel(item.status)} · ${
                item.hasCaseRecord ? "已写记录" : "未写记录"
              }`,
          )}
      />
      <DetailList
        title="请假记录"
        items={detail.leaveRequests
          .slice(0, 6)
          .map((item) => `${formatDateTime(item.createdAt)} · ${statusLabel(item.status)} · ${item.reason}`)}
      />
      <DetailList
        title="咨询室使用"
        items={detail.roomUsage
          .slice(0, 8)
          .map(
            (item) =>
              `${formatDateTime(item.startTime)} · ${item.centerName || "-"} ${item.roomName || ""} · ${statusLabel(
                item.status,
              )}`,
          )}
      />
    </aside>
  );
}
