import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";

import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { PagedResult, UserBoardDetail, UserBoardSummary } from "@/types/api";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
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
import type { UserBoardFilters } from "@/types/app";
import { roleText } from "@/lib/display";

export function UserBoardPanel({
  users,
  listLoading,
  selected,
  detailLoading,
  filters,
  setFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onCloseDetail,
}: {
  users?: PagedResult<UserBoardSummary>;
  listLoading: boolean;
  selected?: UserBoardDetail;
  detailLoading: boolean;
  filters: UserBoardFilters;
  setFilters: Dispatch<SetStateAction<UserBoardFilters>>;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <UserBoardListSection
        filters={filters}
        listLoading={listLoading}
        onOpen={onOpen}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onReset={onReset}
        onSearch={onSearch}
        setFilters={setFilters}
        users={users}
      />
      {(detailLoading || selected) && (
        <DetailDrawer title="用户详情" onClose={onCloseDetail}>
          {detailLoading && !selected ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
          ) : selected ? (
            <UserDetailPanel detail={selected} />
          ) : null}
        </DetailDrawer>
      )}
    </>
  );
}

const UserBoardListSection = memo(function UserBoardListSection({
  users,
  listLoading,
  filters,
  setFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
}: {
  users?: PagedResult<UserBoardSummary>;
  listLoading: boolean;
  filters: UserBoardFilters;
  setFilters: Dispatch<SetStateAction<UserBoardFilters>>;
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
          <h2 className="text-xl font-semibold tracking-normal">用户看板</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            按用户聚合订单、退款、豁免、预约和咨询室预约记录。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="姓名/昵称">
            <input
              className={queryControlClass}
              placeholder="请输入"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            />
          </QueryField>
          <QueryField label="性别">
            <select
              className={`${queryControlClass} appearance-auto`}
              value={filters.gender}
              onChange={(event) => setFilters((prev) => ({ ...prev, gender: event.target.value }))}
            >
              <option value="">全部性别</option>
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="其他">其他</option>
            </select>
          </QueryField>
          <QueryField label="电话">
            <input
              className={queryControlClass}
              placeholder="请输入"
              value={filters.mobile}
              onChange={(event) => setFilters((prev) => ({ ...prev, mobile: event.target.value }))}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="relative">
        {listLoading && users && users.items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!users || users.items.length === 0 ? (
        <EmptyState text={listLoading ? "正在加载列表..." : "暂无用户数据。"} />
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">用户</th>
                <th className="px-5 py-3 font-medium">手机</th>
                <th className="px-5 py-3 font-medium">订单/金额</th>
                <th className="px-5 py-3 font-medium">预约</th>
                <th className="px-5 py-3 font-medium">退款/豁免</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.items.map((user) => (
                <tr key={user.id} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4">
                    <div className="font-medium">{user.name}</div>
                    <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{roleText(user.roles)}</div>
                  </td>
                  <td className="px-5 py-4">{user.mobile || "-"}</td>
                  <td className="px-5 py-4">
                    {user.orderCount} / {formatMoneyFromCents(user.paidAmount)}
                  </td>
                  <td className="px-5 py-4">
                    总 {user.consultationCount}，完成 {user.completedConsultationCount}，取消{" "}
                    {user.cancelledConsultationCount}
                  </td>
                  <td className="px-5 py-4">
                    退款 {user.refundCount}，豁免 {user.exemptionCount}
                  </td>
                  <td className="px-5 py-4">
                    <TableActionButton onClick={() => onOpen(user.id)}>
                      查看
                    </TableActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={users.page}
            pageSize={users.pageSize}
            total={users.total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
      </div>
    </section>
  );
});

function UserDetailPanel({ detail }: { detail: UserBoardDetail }) {
  const completedConsultations = detail.consultations.filter((item) => item.status === "DONE");
  const cancelledConsultations = detail.consultations.filter(
    (item) => item.status === "CANCELLED" || item.status === "CANCELED",
  );
  const consultationText = (item: UserBoardDetail["consultations"][number]) =>
    `${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${item.counselorName} · ${statusLabel(
      item.status,
    )} · ${item.centerName || "-"} ${item.roomName || ""}${item.note ? ` · ${item.note}` : ""}`;
  const roomBookingText = (item: UserBoardDetail["roomBookings"][number]) =>
    `咨询 #${item.consultationId} · ${formatDateTime(item.startTime)} 至 ${formatDateTime(item.endTime)} · ${
      item.centerName || "-"
    } ${item.roomName || ""}`;

  return (
    <>
      <div className="text-sm text-[var(--lxxl-muted)]">用户详情</div>
      <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">
        {detail.profile.mobile || "-"} · {detail.profile.gender || "性别未填"} · {roleText(detail.profile.roles)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="订单" value={detail.profile.orderCount} />
        <MiniStat label="已付金额" value={formatMoneyFromCents(detail.profile.paidAmount)} />
        <MiniStat label="退款金额" value={formatMoneyFromCents(detail.profile.refundAmount)} />
        <MiniStat label="预约总数" value={detail.profile.consultationCount} />
        <MiniStat label="完成预约" value={detail.profile.completedConsultationCount} />
        <MiniStat label="取消预约" value={detail.profile.cancelledConsultationCount} />
        <MiniStat label="豁免" value={detail.profile.exemptionCount} />
        <MiniStat label="待审豁免" value={detail.profile.pendingExemptionCount} />
      </div>
      <DetailList
        title="预约记录"
        items={detail.consultations.map(consultationText)}
      />
      <DetailList
        title="完成预约记录"
        items={completedConsultations.map(consultationText)}
      />
      <DetailList
        title="取消预约记录"
        items={cancelledConsultations.map(consultationText)}
      />
      <DetailList
        title="订单记录"
        items={detail.orders.map(
          (item) =>
            `订单 #${item.id} · ${formatDateTime(item.createdAt)} · ${formatMoneyFromCents(item.totalFee)} · ${statusLabel(
              item.status,
            )}${item.outTradeNo ? ` · ${item.outTradeNo}` : ""}${item.description ? ` · ${item.description}` : ""}`,
        )}
      />
      <DetailList
        title="付款记录"
        items={detail.payments.map(
          (item) => `付款 #${item.id} · ${formatDateTime(item.paidAt)} · ${formatMoneyFromCents(item.amount)} · ${statusLabel(item.status)}`,
        )}
      />
      <DetailList
        title="退款记录"
        items={detail.refunds.map(
          (item) =>
            `退款 #${item.id} · ${formatDateTime(item.updatedAt)} · ${formatMoneyFromCents(item.amount)} · ${statusLabel(
              item.status,
            )}`,
        )}
      />
      <DetailList
        title="豁免记录"
        items={detail.exemptions.map(
          (item) =>
            `豁免 #${item.id} · ${formatDateTime(item.createdAt)} · ${formatMoneyFromCents(item.amount)} · ${statusLabel(
              item.status,
            )} · ${item.reason}${item.rejectReason ? ` · 拒绝原因：${item.rejectReason}` : ""}`,
        )}
      />
      <DetailList
        title="预约咨询室记录"
        items={detail.roomBookings.map(roomBookingText)}
      />
      <DetailList
        title="更换咨询室记录"
        items={[]}
      />
    </>
  );
}
