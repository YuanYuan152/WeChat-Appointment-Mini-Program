import { formatDateTime, statusLabel } from "@/lib/format";
import type { ScheduleOverview } from "@/types/api";

import { getLocalDateValue } from "@/lib/date";
import { getPageItems } from "@/lib/pagination";
import { Badge, EmptyState, Pagination, QueryButton, QueryField, QueryResetButton, queryControlClass } from "@/components/ui";

export function SchedulesPanel({
  schedules,
  listLoading,
  selectedDate,
  setSelectedDate,
  selectedKeyword,
  setSelectedKeyword,
  queryKeyword,
  page,
  pageSize,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
}: {
  schedules?: ScheduleOverview;
  listLoading: boolean;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  selectedKeyword: string;
  setSelectedKeyword: (value: string) => void;
  queryKeyword: string;
  page: number;
  pageSize: number;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const rows = schedules?.counselors.flatMap((counselor) =>
    counselor.schedules.map((schedule) => ({ counselorName: counselor.counselorName, ...schedule })),
  ) || [];
  const normalizedKeyword = queryKeyword.trim().toLowerCase();
  const filteredRows = normalizedKeyword
    ? rows.filter((row) =>
        [row.counselorName, row.patientName, row.centerName, row.roomName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword),
      )
    : rows;
  const { currentPage, items } = getPageItems(filteredRows, page, pageSize);

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
            日期：{schedules?.date || getLocalDateValue()}。复用运营排期总览接口。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="日期">
            <input
              className={queryControlClass}
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </QueryField>
          <QueryField label="姓名">
            <input
              className={queryControlClass}
              placeholder="咨询师/来访者"
              value={selectedKeyword}
              onChange={(event) => setSelectedKeyword(event.target.value)}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="relative">
        {listLoading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {filteredRows.length === 0 ? (
        <EmptyState text={listLoading ? "正在加载列表..." : "该日期暂无排期记录。"} />
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">咨询师</th>
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">预约中心</th>
                <th className="px-5 py-3 font-medium">咨询室</th>
                <th className="px-5 py-3 font-medium">来访者</th>
                <th className="px-5 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.scheduleId} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4">{row.counselorName}</td>
                  <td className="px-5 py-4">
                    {formatDateTime(row.startTime)} - {formatDateTime(row.endTime)}
                  </td>
                  <td className="px-5 py-4">{row.centerName || "-"}</td>
                  <td className="px-5 py-4">{row.roomName || row.roomId || "-"}</td>
                  <td className="px-5 py-4">{row.patientName || "-"}</td>
                  <td className="px-5 py-4">
                    <Badge tone="green">{scheduleStatusLabel(row.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filteredRows.length}
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
