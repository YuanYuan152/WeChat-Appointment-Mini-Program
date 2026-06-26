import { memo } from "react";

import { formatDateTime, statusLabel } from "@/lib/format";
import type { CounselorBoardDetail, CounselorBoardSummary, PagedResult } from "@/types/api";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  Badge,
  DetailList,
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
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{record.caseRecordCount}</span>
                        <Badge tone={record.missingRecordCount > 0 ? "gold" : "green"}>
                          缺 {record.missingRecordCount}
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
  return (
    <>
      <div className="text-sm text-[var(--lxxl-muted)]">咨询师详情</div>
      <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">{detail.profile.mobile || "-"}</div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="咨询" value={detail.profile.consultationCount} />
        <MiniStat label="已完成" value={detail.profile.completedConsultationCount} />
        <MiniStat label="缺记录" value={detail.profile.missingRecordCount} />
        <MiniStat label="个案记录" value={detail.profile.caseRecordCount} />
        <MiniStat label="请假" value={detail.profile.leaveRequestCount} />
        <MiniStat label="排期" value={detail.profile.scheduleCount} />
        <MiniStat label="已预约排班" value={detail.profile.bookedScheduleCount} />
        <MiniStat label="咨询室使用" value={detail.roomUsage.length} />
      </div>
      <DetailList
        title="咨询明细"
        items={detail.consultations.map(
          (item) =>
            `咨询 #${item.id} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
              item.patientName
            }${item.patientMobile ? `（${item.patientMobile}）` : ""} · ${statusLabel(item.status)} · ${
              item.hasCaseRecord ? "已写记录" : "未写记录"
            }`,
        )}
      />
      <DetailList
        title="咨询记录"
        items={detail.caseRecords.map(
          (item) =>
            `记录 #${item.id} · 咨询 #${item.consultationId} · 创建 ${formatDateTime(item.createdAt)} · 更新 ${formatDateTime(
              item.updatedAt,
            )}${item.preview ? ` · ${item.preview}` : ""}`,
        )}
      />
      <DetailList
        title="请假记录"
        items={detail.leaveRequests.map(
          (item) =>
            `请假 #${item.id} · 排班 #${item.scheduleId} · ${formatDateTime(item.createdAt)} · ${statusLabel(item.status)} · ${
              item.reason
            }`,
        )}
      />
      <DetailList
        title="排班记录"
        items={detail.schedules.map(
          (item) =>
            `排班 #${item.id} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
              item.centerName || "-"
            } ${item.roomName || ""} · ${statusLabel(item.status)}`,
        )}
      />
      <DetailList
        title="使用咨询室记录"
        items={detail.roomUsage.map(
          (item) =>
            `排班 #${item.scheduleId} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
              item.centerName || "-"
            } ${item.roomName || ""} · ${statusLabel(item.status)}`,
        )}
      />
      <DetailList
        title="更换咨询室记录"
        items={[]}
      />
    </>
  );
}
