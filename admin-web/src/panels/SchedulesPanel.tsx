import { formatDateTime, statusLabel } from "@/lib/format";
import type { ScheduleOverview } from "@/types/api";

import { getPageItems } from "@/lib/pagination";
import { Badge, EmptyState, Pagination, QueryButton, QueryField, QueryResetButton, TableActionButton, queryControlClass } from "@/components/ui";

export type ScheduleFilter = "all" | "today" | "week";

export function SchedulesPanel({
  schedules,
  listLoading,
  selectedKeyword,
  setSelectedKeyword,
  scheduleFilter,
  onScheduleFilterChange,
  page,
  pageSize,
  onSearch,
  onReset,
  onViewCounselor,
  onPageChange,
  onPageSizeChange,
}: {
  schedules?: ScheduleOverview;
  listLoading: boolean;
  selectedKeyword: string;
  setSelectedKeyword: (value: string) => void;
  scheduleFilter: ScheduleFilter;
  onScheduleFilterChange: (value: ScheduleFilter) => void;
  page: number;
  pageSize: number;
  onSearch: () => void;
  onReset: () => void;
  onViewCounselor: (counselor: ScheduleOverview["counselors"][number]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const counselors = schedules?.counselors || [];
  const { currentPage, items } = getPageItems(counselors, page, pageSize);

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
          <h2 className="text-xl font-semibold tracking-normal">排期情况</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            默认展示 {schedules?.startDate || schedules?.date || "今天"} 至 {schedules?.endDate || "未来30天"} 的全部咨询师。
          </p>
        </div>

        <div className="mt-5 max-w-xl">
          <QueryField label="咨询师或来访">
            <input
              className={queryControlClass}
              placeholder="搜索姓名或昵称"
              value={selectedKeyword}
              onChange={(event) => setSelectedKeyword(event.target.value)}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex max-w-xl flex-wrap gap-2" aria-label="预约时间筛选">
          {([
            ["all", "全部"],
            ["today", "仅今日有约"],
            ["week", "仅本周有约"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                scheduleFilter === value
                  ? "border-[var(--lxxl-green)] bg-[var(--lxxl-green)] text-white"
                  : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-muted)] hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
              }`}
              aria-pressed={scheduleFilter === value}
              onClick={() => onScheduleFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="relative">
        {listLoading && counselors.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {counselors.length === 0 ? (
        <EmptyState text={listLoading ? "正在加载列表..." : emptyText(scheduleFilter)} />
      ) : (
        <>
          <div className="grid gap-4 border-t border-[var(--lxxl-border)] p-5 lg:grid-cols-2">
            {items.map((counselor) => (
              <article key={counselor.counselorId} className="rounded-xl border border-[var(--lxxl-border)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{counselor.counselorName}</h3>
                    <p className="mt-1 text-xs text-[var(--lxxl-muted)]">{countText(scheduleFilter, counselor.scheduleCount)}</p>
                  </div>
                  <TableActionButton onClick={() => onViewCounselor(counselor)}>查看完整排期</TableActionButton>
                </div>
                <div className="mt-4 space-y-3">
                  {counselor.schedules.length ? counselor.schedules.map((schedule) => (
                    <div key={schedule.scheduleId} className="rounded-lg bg-[#FAF8F4] px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {counselor.counselorName} - {schedule.patientName || "开放排期"}
                        </span>
                        <Badge tone="green">{scheduleStatusLabel(schedule.status)}</Badge>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                        {formatDateTime(schedule.startTime)} · {schedule.centerName || "未指定中心"}
                        {schedule.roomName ? ` · ${schedule.roomName}` : ""}
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-[var(--lxxl-muted)]">未来30天暂无排期</div>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={counselors.length}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
      </div>
    </section>
  );
}

function scheduleStatusLabel(status?: string | null) {
  if (status === "AVAILABLE") {
    return "可排期";
  }
  return statusLabel(status);
}

function emptyText(filter: ScheduleFilter) {
  if (filter === "today") return "今日暂无已预约排期。";
  if (filter === "week") return "未来7天暂无已预约排期。";
  return "暂无匹配的咨询师或排期。";
}

function countText(filter: ScheduleFilter, count: number) {
  if (filter === "today") return `今日已约 ${count} 节`;
  if (filter === "week") return `未来7天已约 ${count} 节`;
  return `未来30天 ${count} 节`;
}
