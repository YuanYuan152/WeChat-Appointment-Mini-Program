import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { CounselorDashboardDetailItem, CounselorDashboardStats } from "@/types/api";
import type { CounselorDashboardCategory, CounselorDashboardPeriod } from "@/services/counselor";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  EmptyState,
  MiniStat,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

const PERIOD_OPTIONS: Array<{ value: CounselorDashboardPeriod; label: string }> = [
  { value: "month", label: "本月" },
  { value: "quarter", label: "近 90 天" },
  { value: "half_year", label: "近半年" },
  { value: "all", label: "全部" },
];

const CATEGORY_OPTIONS: Array<{
  key: CounselorDashboardCategory;
  label: string;
  valueKey: keyof CounselorDashboardStats;
  amountKey?: keyof CounselorDashboardStats;
}> = [
  { key: "orders", label: "完成订单", valueKey: "completedOrderCount", amountKey: "completedOrderRevenue" },
  { key: "case-records", label: "咨询记录", valueKey: "caseRecordCount" },
  { key: "appointments", label: "预约咨询", valueKey: "totalAppointments" },
  { key: "leaves", label: "请假申请", valueKey: "leaveCount" },
];

export function CounselorDashboardPanel({
  stats,
  details,
  listLoading,
  detailLoading,
  period,
  selectedCategory,
  setPeriod,
  onSearch,
  onReset,
  onOpenCategory,
  onCloseDetail,
}: {
  stats?: CounselorDashboardStats;
  details?: CounselorDashboardDetailItem[];
  listLoading: boolean;
  detailLoading: boolean;
  period: CounselorDashboardPeriod;
  selectedCategory?: CounselorDashboardCategory;
  setPeriod: (value: CounselorDashboardPeriod) => void;
  onSearch: () => void;
  onReset: () => void;
  onOpenCategory: (category: CounselorDashboardCategory) => void;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div>
            <h2 className="text-xl font-semibold tracking-normal">个人看板</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              查看自己的咨询、订单、咨询记录和请假数据，点击数据卡片查看明细。
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="统计周期">
              <select
                className={queryControlClass}
                value={period}
                onChange={(event) => setPeriod(event.target.value as CounselorDashboardPeriod)}
              >
                {PERIOD_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="relative border-t border-[var(--lxxl-border)] p-6 sm:p-7 lg:p-8">
          {listLoading && stats && (
            <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载看板...
            </div>
          )}
          {!stats ? (
            <EmptyState text={listLoading ? "正在加载看板..." : "暂无看板数据。"} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {CATEGORY_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4 text-left transition hover:border-[var(--lxxl-green)] hover:bg-[#FAF8F4]"
                  type="button"
                  onClick={() => onOpenCategory(item.key)}
                >
                  <div className="text-sm text-[var(--lxxl-muted)]">{item.label}</div>
                  <div className="mt-3 text-2xl font-semibold">{stats[item.valueKey] ?? 0}</div>
                  {item.amountKey && (
                    <div className="mt-2 text-sm text-[var(--lxxl-muted)]">
                      {formatMoneyFromCents(Number(stats[item.amountKey] || 0))}
                    </div>
                  )}
                </button>
              ))}
              <MiniStat label="总咨询" value={stats.totalConsultations ?? 0} />
              <MiniStat label="本月咨询" value={stats.monthConsultations ?? 0} />
              <MiniStat label="待开始咨询" value={stats.pendingConsultations ?? 0} />
              <MiniStat label="已完成咨询" value={stats.doneConsultations ?? 0} />
            </div>
          )}
        </div>
      </section>

      {selectedCategory && (
        <DetailDrawer title={`${categoryLabel(selectedCategory)}明细`} onClose={onCloseDetail}>
          {detailLoading && !details ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载明细...</div>
          ) : details && details.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">对象</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">补充</th>
                </tr>
              </thead>
              <tbody>
                {details.map((item) => (
                  <tr key={`${selectedCategory}-${item.id}`} className="border-t border-[var(--lxxl-border)]">
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3 text-[var(--lxxl-muted)]">{formatDateTime(item.subtitle)}</td>
                    <td className="px-4 py-3 text-[var(--lxxl-muted)]">{statusLabel(item.status)}</td>
                    <td className="px-4 py-3 text-[var(--lxxl-muted)]">
                      {item.amount != null ? `${formatMoneyFromCents(item.amount)} · ` : ""}
                      {item.extra || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState text={detailLoading ? "正在加载明细..." : "暂无明细。"} />
          )}
          {details && details.length > 0 && (
            <div className="mt-4">
              <TableActionButton tone="muted" onClick={onCloseDetail}>
                收起明细
              </TableActionButton>
            </div>
          )}
        </DetailDrawer>
      )}
    </>
  );
}

function categoryLabel(category: CounselorDashboardCategory) {
  const found = CATEGORY_OPTIONS.find((item) => item.key === category);
  return found?.label || "看板";
}
