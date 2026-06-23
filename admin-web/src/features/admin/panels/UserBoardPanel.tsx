import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { PagedResult, UserBoardDetail, UserBoardSummary } from "@/types/api";

import { DetailList, EmptyState, MiniStat, PanelHeader } from "../components/ui";
import { roleText } from "../utils";

export function UserBoardPanel({
  users,
  selected,
  keyword,
  setKeyword,
  onSearch,
  onOpen,
}: {
  users?: PagedResult<UserBoardSummary>;
  selected?: UserBoardDetail;
  keyword: string;
  setKeyword: (value: string) => void;
  onSearch: () => void;
  onOpen: (accountId: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_380px] gap-6">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <PanelHeader
          title="用户看板"
          description="按用户聚合订单、退款、豁免、预约和咨询室预约记录。"
          action={
            <div className="flex gap-2">
              <input
                className="h-10 w-72 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
                placeholder="按姓名/昵称/电话搜索"
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
        {!users || users.items.length === 0 ? (
          <EmptyState text="暂无用户数据。" />
        ) : (
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
                    <button
                      className="text-sm font-medium text-[var(--lxxl-green)]"
                      type="button"
                      onClick={() => onOpen(user.id)}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <UserDetailPanel detail={selected} />
    </div>
  );
}

function UserDetailPanel({ detail }: { detail?: UserBoardDetail }) {
  if (!detail) {
    return (
      <aside className="rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
        <div className="text-sm text-[var(--lxxl-muted)]">用户详情</div>
        <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
          点击左侧用户后查看订单、付款、退款、豁免、预约和咨询室记录。
        </p>
      </aside>
    );
  }

  return (
    <aside className="max-h-[calc(100vh-120px)] overflow-auto rounded-xl border border-[var(--lxxl-border)] bg-white p-5">
      <div className="text-sm text-[var(--lxxl-muted)]">用户详情</div>
      <h3 className="mt-2 text-lg font-semibold">{detail.profile.name}</h3>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">
        {detail.profile.mobile || "-"} · {roleText(detail.profile.roles)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="订单" value={detail.profile.orderCount} />
        <MiniStat label="已付金额" value={formatMoneyFromCents(detail.profile.paidAmount)} />
        <MiniStat label="预约" value={detail.profile.consultationCount} />
        <MiniStat label="豁免" value={detail.profile.exemptionCount} />
      </div>
      <DetailList
        title="最近预约"
        items={detail.consultations
          .slice(0, 8)
          .map(
            (item) =>
              `${formatDateTime(item.startTime)} · ${item.counselorName} · ${statusLabel(item.status)} · ${
                item.centerName || "-"
              } ${item.roomName || ""}`,
          )}
      />
      <DetailList
        title="订单记录"
        items={detail.orders
          .slice(0, 6)
          .map((item) => `${formatDateTime(item.createdAt)} · ${formatMoneyFromCents(item.totalFee)} · ${statusLabel(item.status)}`)}
      />
      <DetailList
        title="豁免记录"
        items={detail.exemptions
          .slice(0, 6)
          .map(
            (item) =>
              `${formatDateTime(item.createdAt)} · ${formatMoneyFromCents(item.amount)} · ${statusLabel(item.status)} · ${
                item.reason
              }`,
          )}
      />
    </aside>
  );
}
