import { useEffect, useMemo, useState } from "react";

import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { CounselorDashboardDetailItem } from "@/types/api";
import type { CounselorDashboardPeriod } from "@/services/counselor";

import {
  EmptyState,
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

export function CounselorOrderDetailsPanel({
  details,
  listLoading,
  period,
  setPeriod,
  onSearch,
  onReset,
}: {
  details?: CounselorDashboardDetailItem[];
  listLoading: boolean;
  period: CounselorDashboardPeriod;
  setPeriod: (value: CounselorDashboardPeriod) => void;
  onSearch: () => void;
  onReset: () => void;
}) {
  const [keywordDraft, setKeywordDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activePatientKey, setActivePatientKey] = useState<string | null>(null);

  useEffect(() => {
    setActivePatientKey(null);
  }, [details]);

  const rows = useMemo(() => details || [], [details]);
  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of rows) {
      if (item.status) {
        values.add(item.status);
      }
    }
    return Array.from(values);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((item) => {
      if (status !== "ALL" && item.status !== status) {
        return false;
      }
      if (!normalizedKeyword) {
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
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, rows, status]);

  const orderGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        mobile?: string | null;
        totalAmount: number;
        personalIncome: number;
        items: CounselorDashboardDetailItem[];
      }
    >();
    for (const item of filteredRows) {
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
  }, [filteredRows]);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        <h2 className="text-xl font-semibold tracking-normal">订单明细</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
          完成订单、订单收入和个人收入统一在这里按来访者和订单展开。
        </p>
      </div>

      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          setKeyword(keywordDraft.trim());
          setStatus(statusDraft);
          setActivePatientKey(null);
          onSearch();
        }}
      >
        <h3 className="text-base font-semibold">
          完成订单明细
          <span className="ml-2 text-sm font-normal text-[var(--lxxl-muted)]">
            {filteredRows.length} / {rows.length} 条
          </span>
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <QueryField label="关键词">
            <input
              className={queryControlClass}
              placeholder="来访者、时间、状态"
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
            />
          </QueryField>
          <QueryField label="状态">
            <select
              className={queryControlClass}
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
            >
              <option value="ALL">全部状态</option>
              {statusOptions.map((itemStatus) => (
                <option key={itemStatus} value={itemStatus}>
                  {statusLabel(itemStatus)}
                </option>
              ))}
            </select>
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton
            onClick={() => {
              setKeywordDraft("");
              setStatusDraft("ALL");
              setKeyword("");
              setStatus("ALL");
              setActivePatientKey(null);
              onReset();
            }}
          />
        </div>
      </form>

      <div className="relative border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        {listLoading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载订单明细...
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载订单明细..." : "暂无订单明细。"} />
        ) : filteredRows.length === 0 ? (
          <EmptyState text="没有符合筛选条件的订单明细。" />
        ) : (
          <div className="space-y-3">
            {orderGroups.map((group) => {
              const active = activePatientKey === group.key;
              return (
                <section key={group.key} className="border-b border-[var(--lxxl-border)] pb-4 last:border-b-0">
                  <button
                    className="flex w-full items-start justify-between gap-4 py-3 text-left"
                    type="button"
                    onClick={() => setActivePatientKey(active ? null : group.key)}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-[#2C2C2C]">
                        {group.title}
                        {group.mobile ? <span className="ml-2 font-normal text-[var(--lxxl-muted)]">{group.mobile}</span> : null}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--lxxl-muted)]">
                        预约次数 {group.items.length} · 订单收入 {formatMoneyFromCents(group.totalAmount)} · 个人收入{" "}
                        {formatMoneyFromCents(group.personalIncome)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                      {active ? "收起" : "展开"}
                    </span>
                  </button>
                  {active && (
                    <div className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {group.items.map((item) => (
                        <OrderDetailCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
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
        <TableActionButton onClick={() => openCounselorRecord(item)}>
          {hasRecord ? "查看记录" : "去填写"}
        </TableActionButton>
      </div>
    </article>
  );
}

function openCounselorRecord(item: CounselorDashboardDetailItem) {
  const params = new URLSearchParams();
  if (item.consultationId != null) {
    params.set("consultationId", String(item.consultationId));
  }
  if (item.caseRecordId != null) {
    params.set("recordId", String(item.caseRecordId));
  }
  const query = params.toString();
  window.location.assign(`/counselor-records${query ? `?${query}` : ""}`);
}
