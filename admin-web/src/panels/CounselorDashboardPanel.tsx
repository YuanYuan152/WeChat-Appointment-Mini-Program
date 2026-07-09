import { formatMoneyFromCents } from "@/lib/format";
import type { CounselorDashboardStats } from "@/types/api";
import type { CounselorDashboardCategory, CounselorDashboardPeriod } from "@/services/counselor";

import {
  EmptyState,
  MiniStat,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";

const PERIOD_OPTIONS: Array<{ value: CounselorDashboardPeriod; label: string }> = [
  { value: "month", label: "本月" },
  { value: "quarter", label: "近 90 天" },
  { value: "half_year", label: "近半年" },
  { value: "all", label: "全部" },
];

const DASHBOARD_CARDS: Array<{
  id: string;
  category: CounselorDashboardCategory;
  label: string;
  valueKey: keyof CounselorDashboardStats;
  valueType?: "count" | "money";
  hint: string;
}> = [
  {
    id: "completed-orders",
    category: "orders",
    label: "完成订单",
    valueKey: "completedOrderCount",
    hint: "进入订单明细",
  },
  {
    id: "order-revenue",
    category: "orders",
    label: "订单收入",
    valueKey: "completedOrderRevenue",
    valueType: "money",
    hint: "进入订单明细",
  },
  {
    id: "personal-income",
    category: "orders",
    label: "个人收入",
    valueKey: "personalIncome",
    valueType: "money",
    hint: "进入订单明细",
  },
  {
    id: "case-records",
    category: "case-records",
    label: "咨询记录",
    valueKey: "caseRecordCount",
    hint: "进入咨询明细",
  },
  {
    id: "appointments",
    category: "appointments",
    label: "预约咨询",
    valueKey: "totalAppointments",
    hint: "进入咨询明细",
  },
];

export function CounselorDashboardPanel({
  stats,
  listLoading,
  period,
  setPeriod,
  onSearch,
  onReset,
  onOpenCategory,
}: {
  stats?: CounselorDashboardStats;
  listLoading: boolean;
  period: CounselorDashboardPeriod;
  setPeriod: (value: CounselorDashboardPeriod) => void;
  onSearch: () => void;
  onReset: () => void;
  onOpenCategory: (category: CounselorDashboardCategory) => void;
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
          <h2 className="text-xl font-semibold tracking-normal">个人看板</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            查看自己的咨询和订单数据；点击数据卡片进入对应明细页面。
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
            {DASHBOARD_CARDS.map((item) => (
              <button
                key={item.id}
                className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4 text-left transition hover:border-[var(--lxxl-green)] hover:bg-[#FAF8F4]"
                type="button"
                onClick={() => onOpenCategory(item.category)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--lxxl-muted)]">{item.label}</span>
                  <span className="text-xs font-medium text-[var(--lxxl-green)]">{item.hint}</span>
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  {item.valueType === "money"
                    ? formatMoneyFromCents(Number(stats[item.valueKey] || 0))
                    : stats[item.valueKey] ?? 0}
                </div>
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
  );
}
