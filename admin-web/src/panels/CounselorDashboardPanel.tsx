import { useEffect, useMemo, useState } from "react";

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

const CATEGORY_LABELS: Record<CounselorDashboardCategory, string> = {
  orders: "完成订单",
  "case-records": "咨询记录",
  appointments: "预约咨询",
  leaves: "请假记录",
};

const DASHBOARD_CARDS: Array<{
  id: string;
  category: CounselorDashboardCategory;
  label: string;
  valueKey: keyof CounselorDashboardStats;
  valueType?: "count" | "money";
}> = [
  { id: "completed-orders", category: "orders", label: "完成订单", valueKey: "completedOrderCount" },
  { id: "order-revenue", category: "orders", label: "订单收入", valueKey: "completedOrderRevenue", valueType: "money" },
  { id: "personal-income", category: "orders", label: "个人收入", valueKey: "personalIncome", valueType: "money" },
  { id: "case-records", category: "case-records", label: "咨询记录", valueKey: "caseRecordCount" },
  { id: "appointments", category: "appointments", label: "预约咨询", valueKey: "totalAppointments" },
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
  const [detailKeywordDraft, setDetailKeywordDraft] = useState("");
  const [detailStatusDraft, setDetailStatusDraft] = useState("ALL");
  const [detailKeyword, setDetailKeyword] = useState("");
  const [detailStatus, setDetailStatus] = useState("ALL");
  const [activePatientKey, setActivePatientKey] = useState<string | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<number | null>(null);

  useEffect(() => {
    setDetailKeywordDraft("");
    setDetailStatusDraft("ALL");
    setDetailKeyword("");
    setDetailStatus("ALL");
    setActivePatientKey(null);
    setActiveDetailId(null);
  }, [selectedCategory]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of details || []) {
      if (item.status) {
        values.add(item.status);
      }
    }
    return Array.from(values);
  }, [details]);

  const filteredDetails = useMemo(() => {
    const keyword = detailKeyword.trim().toLowerCase();
    return (details || []).filter((item) => {
      if (detailStatus !== "ALL" && item.status !== detailStatus) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        item.title,
        item.subtitle,
        item.extra,
        item.status,
        item.patientMobile,
        item.caseRecordStatus,
        item.amount != null ? formatMoneyFromCents(item.amount) : "",
        item.personalIncome != null ? formatMoneyFromCents(item.personalIncome) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [detailKeyword, detailStatus, details]);

  const orderGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      title: string;
      mobile?: string | null;
      totalAmount: number;
      personalIncome: number;
      items: CounselorDashboardDetailItem[];
    }>();
    for (const item of filteredDetails) {
      const key = `${item.patientId ?? item.title}-${item.patientMobile ?? ""}`;
      const current = groups.get(key) || {
        key,
        title: item.title,
        mobile: item.patientMobile,
        totalAmount: 0,
        personalIncome: 0,
        items: [],
      };
      current.totalAmount += Number(item.amount || 0);
      current.personalIncome += Number(item.personalIncome || 0);
      current.items.push(item);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }, [filteredDetails]);

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
              查看自己的咨询、订单和咨询记录数据，点击数据卡片查看明细。
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
                  <div className="text-sm text-[var(--lxxl-muted)]">{item.label}</div>
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

      {selectedCategory && (
        <DetailDrawer title={`${categoryLabel(selectedCategory)}明细`} onClose={onCloseDetail}>
          {detailLoading && !details ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载明细...</div>
          ) : details && details.length > 0 ? (
            <div className="space-y-4">
              <form
                className="border-b border-[var(--lxxl-border)] pb-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setDetailKeyword(detailKeywordDraft.trim());
                  setDetailStatus(detailStatusDraft);
                  setActivePatientKey(null);
                  setActiveDetailId(null);
                }}
              >
                <h4 className="text-base font-semibold">
                  {categoryLabel(selectedCategory)}明细
                  <span className="ml-2 text-sm font-normal text-[var(--lxxl-muted)]">
                    {filteredDetails.length} / {details.length} 条
                  </span>
                </h4>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <QueryField label="关键词">
                    <input
                      className={queryControlClass}
                      placeholder="来访者、时间、状态"
                      value={detailKeywordDraft}
                      onChange={(event) => setDetailKeywordDraft(event.target.value)}
                    />
                  </QueryField>
                  <QueryField label="状态">
                    <select
                      className={queryControlClass}
                      value={detailStatusDraft}
                      onChange={(event) => setDetailStatusDraft(event.target.value)}
                    >
                      <option value="ALL">全部状态</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </QueryField>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <QueryButton type="submit" />
                  <QueryResetButton
                    onClick={() => {
                      setDetailKeywordDraft("");
                      setDetailStatusDraft("ALL");
                      setDetailKeyword("");
                      setDetailStatus("ALL");
                      setActivePatientKey(null);
                      setActiveDetailId(null);
                    }}
                  />
                </div>
              </form>
              {filteredDetails.length === 0 ? (
                <EmptyState text="没有符合筛选条件的明细。" />
              ) : selectedCategory === "orders" ? (
                <div className="space-y-3">
                  {orderGroups.map((group) => {
                    const active = activePatientKey === group.key;
                    return (
                      <section key={group.key} className="border-b border-[var(--lxxl-border)] pb-3 last:border-b-0">
                        <button
                          className="flex w-full items-start justify-between gap-4 py-2 text-left"
                          type="button"
                          onClick={() => {
                            setActivePatientKey(active ? null : group.key);
                            setActiveDetailId(null);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[#2C2C2C]">
                              {group.title}
                              {group.mobile ? <span className="ml-2 font-normal text-[var(--lxxl-muted)]">{group.mobile}</span> : null}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--lxxl-muted)]">
                              预约次数 {group.items.length} · 订单收入 {formatMoneyFromCents(group.totalAmount)} · 个人收入{" "}
                              {formatMoneyFromCents(group.personalIncome)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                            {active ? "收起" : "展开"}
                          </span>
                        </button>
                        {active && (
                          <div className="mt-2 space-y-3">
                            {group.items.map((item) => (
                              <OrderDetailCard key={item.id} item={item} />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDetails.map((item) => {
                    const active = activeDetailId === item.id;
                    return (
                      <div key={`${selectedCategory}-${item.id}`} className="border-b border-[var(--lxxl-border)] py-3 last:border-b-0">
                        <button
                          className="flex w-full items-start justify-between gap-4 text-left text-sm"
                          type="button"
                          onClick={() => setActiveDetailId(active ? null : item.id)}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-[#2C2C2C]">{item.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--lxxl-muted)]">
                              {formatDateTime(item.subtitle)}
                              {item.status ? ` · ${statusLabel(item.status)}` : ""}
                              {item.amount != null ? ` · ${formatMoneyFromCents(item.amount)}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                            {active ? "收起" : "查看详情"}
                          </span>
                        </button>
                        {active && (
                          <div className="mt-3 rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-muted)]">
                            <DetailLine label="来访者" value={item.title} />
                            <DetailLine label="时间" value={formatDateTime(item.subtitle)} />
                            <DetailLine label="状态" value={statusLabel(item.status)} />
                            {item.amount != null && <DetailLine label="金额" value={formatMoneyFromCents(item.amount)} />}
                            {item.extra && <DetailLine label="补充信息" value={item.extra} />}
                            {item.consultationId != null && <DetailLine label="关联咨询" value={`咨询单 ${item.consultationId}`} />}
                            {item.caseRecordId != null && <DetailLine label="关联记录" value={`咨询记录 ${item.caseRecordId}`} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <EmptyState text={detailLoading ? "正在加载明细..." : "暂无明细。"} />
          )}
        </DetailDrawer>
      )}
    </>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <span className="text-[var(--lxxl-muted)]">{label}</span>
      <span className="text-[#2C2C2C]">{value || "-"}</span>
    </div>
  );
}

function OrderDetailCard({ item }: { item: CounselorDashboardDetailItem }) {
  const hasRecord = item.caseRecordStatus === "FILLED" || Boolean(item.caseRecordId);

  return (
    <article className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-[#2C2C2C]">
            {formatDateTime(item.subtitle)} · {statusLabel(item.status)}
          </div>
          <div className="mt-2 grid gap-1 text-xs leading-5 text-[var(--lxxl-muted)]">
            <span>订单收入：{formatMoneyFromCents(item.amount)}</span>
            <span>个人收入：{formatMoneyFromCents(item.personalIncome)}</span>
            <span>咨询记录：{hasRecord ? "已填写" : "待填写"}</span>
            {item.extra ? <span>{item.extra}</span> : null}
          </div>
        </div>
        <TableActionButton
          onClick={() => {
            const params = new URLSearchParams();
            if (item.consultationId != null) {
              params.set("consultationId", String(item.consultationId));
            }
            if (item.caseRecordId != null) {
              params.set("recordId", String(item.caseRecordId));
            }
            const query = params.toString();
            window.location.assign(`/counselor-records${query ? `?${query}` : ""}`);
          }}
        >
          {hasRecord ? "查看记录" : "去填写"}
        </TableActionButton>
      </div>
    </article>
  );
}

function categoryLabel(category: CounselorDashboardCategory) {
  return CATEGORY_LABELS[category] || "看板";
}
