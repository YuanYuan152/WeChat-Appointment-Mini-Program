import { statusLabel } from "@/lib/format";
import type { Room, RoomStatusSnapshot } from "@/types/api";
import type { Dispatch, SetStateAction } from "react";

import { getPageItems } from "@/lib/pagination";
import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";
import { TimePicker } from "@/components/TimePicker";
import { getLocalDateValue } from "@/lib/date";
import type { RoomFilters } from "@/types/app";

export function RoomsPanel({
  rooms,
  roomStatus,
  listLoading,
  filters,
  setFilters,
  page,
  pageSize,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
}: {
  rooms?: Room[];
  roomStatus?: RoomStatusSnapshot;
  listLoading: boolean;
  filters: RoomFilters;
  setFilters: Dispatch<SetStateAction<RoomFilters>>;
  page: number;
  pageSize: number;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const statusMap = new Map((roomStatus?.rooms || []).map((room) => [`${room.centerId}-${room.roomCode}`, room]));
  const allRooms = rooms || [];
  const { currentPage, items } = getPageItems(allRooms, page, pageSize);
  const snapshotText = `${roomStatus?.date || filters.date || getLocalDateValue()}${
    roomStatus?.timeSlot || filters.timeSlot ? ` ${roomStatus?.timeSlot || filters.timeSlot}` : ""
  }`;

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
          <h2 className="text-xl font-semibold tracking-normal">咨询室情况</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">快照：{snapshotText}。支持按预约中心、日期和时段查询。</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="预约中心">
            <select
              className={queryControlClass}
              value={filters.centerId}
              onChange={(event) => setFilters((prev) => ({ ...prev, centerId: event.target.value }))}
            >
              <option value="">全部中心</option>
              <option value="yangpu">杨浦预约中心</option>
              <option value="pudong">浦东预约中心</option>
            </select>
          </QueryField>

          <QueryField label="日期">
            <input
              className={queryControlClass}
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
            />
          </QueryField>

          <QueryField label="时段">
            <TimePicker
              value={filters.timeSlot}
              onChange={(value) => setFilters((prev) => ({ ...prev, timeSlot: value }))}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>

      <div className="relative">
        {listLoading && allRooms.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {allRooms.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无咨询室数据。"} />
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">预约中心</th>
                  <th className="px-5 py-3 font-medium">咨询室</th>
                  <th className="px-5 py-3 font-medium">全局状态</th>
                  <th className="px-5 py-3 font-medium">当前占用</th>
                  <th className="px-5 py-3 font-medium">咨询师</th>
                  <th className="px-5 py-3 font-medium">来访者</th>
                </tr>
              </thead>
              <tbody>
                {items.map((room) => {
                  const snapshot = statusMap.get(`${room.centerId}-${room.roomCode}`);
                  return (
                    <tr key={`${room.centerId}-${room.roomCode}`} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-5 py-4">{room.centerName}</td>
                      <td className="px-5 py-4">{room.name}</td>
                      <td className="px-5 py-4">
                        <Badge>{statusLabel(room.status)}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={snapshot?.occupancy === "IN_SESSION" ? "gold" : "green"}>
                          {statusLabel(snapshot?.occupancy)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">{snapshot?.counselorName || "-"}</td>
                      <td className="px-5 py-4">{snapshot?.patientName || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={allRooms.length}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
    </section>
  );
}
