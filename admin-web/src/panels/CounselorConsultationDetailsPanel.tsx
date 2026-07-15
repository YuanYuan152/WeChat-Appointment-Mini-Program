import { useEffect, useMemo, useState } from "react";

import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
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

export type CounselorConsultationDetailTab = "case-records" | "appointments";

const PERIOD_OPTIONS: Array<{ value: CounselorDashboardPeriod; label: string }> = [
  { value: "month", label: "本月" },
  { value: "quarter", label: "近 90 天" },
  { value: "half_year", label: "近半年" },
  { value: "all", label: "全部" },
];

const TAB_OPTIONS: Array<{ value: CounselorConsultationDetailTab; label: string; description: string }> = [
  { value: "case-records", label: "咨询记录", description: "已填写或待填写的咨询记录明细" },
  { value: "appointments", label: "预约咨询", description: "预约咨询状态和关联记录明细" },
];

export function CounselorConsultationDetailsPanel({
  caseRecordDetails,
  appointmentDetails,
  listLoading,
  period,
  activeTab,
  setPeriod,
  setActiveTab,
  onSearch,
  onReset,
}: {
  caseRecordDetails?: CounselorDashboardDetailItem[];
  appointmentDetails?: CounselorDashboardDetailItem[];
  listLoading: boolean;
  period: CounselorDashboardPeriod;
  activeTab: CounselorConsultationDetailTab;
  setPeriod: (value: CounselorDashboardPeriod) => void;
  setActiveTab: (value: CounselorConsultationDetailTab) => void;
  onSearch: () => void;
  onReset: () => void;
}) {
  const [keywordDraft, setKeywordDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activeDetailId, setActiveDetailId] = useState<number | null>(null);

  const activeRows = useMemo(
    () => (activeTab === "case-records" ? caseRecordDetails || [] : appointmentDetails || []),
    [activeTab, appointmentDetails, caseRecordDetails],
  );

  useEffect(() => {
    setStatusDraft("ALL");
    setStatus("ALL");
    setActiveDetailId(null);
  }, [activeTab]);

  useEffect(() => {
    setActiveDetailId(null);
  }, [activeRows]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of activeRows) {
      if (item.status) {
        values.add(item.status);
      }
    }
    return Array.from(values);
  }, [activeRows]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return activeRows.filter((item) => {
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
        item.patientContractTag,
        item.caseRecordStatus,
        item.amount != null ? formatMoneyFromCents(item.amount) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
    });
  }, [activeRows, keyword, status]);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        <h2 className="text-xl font-semibold tracking-normal">咨询明细</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
          咨询记录和预约咨询在同一页面查看，避免在工作台中承载过多侧栏内容。
        </p>
      </div>

      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          setKeyword(keywordDraft.trim());
          setStatus(statusDraft);
          setActiveDetailId(null);
          onSearch();
        }}
      >
        <h3 className="text-base font-semibold">
          {activeTab === "case-records" ? "咨询记录明细" : "预约咨询明细"}
          <span className="ml-2 text-sm font-normal text-[var(--lxxl-muted)]">
            {filteredRows.length} / {activeRows.length} 条
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
              setActiveDetailId(null);
              onReset();
            }}
          />
        </div>
      </form>

      <div className="border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        <div className="flex flex-wrap gap-3">
          {TAB_OPTIONS.map((item) => {
            const active = activeTab === item.value;
            const count = item.value === "case-records" ? caseRecordDetails?.length || 0 : appointmentDetails?.length || 0;
            return (
              <button
                key={item.value}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[var(--lxxl-green)] bg-[#EAF2ED] text-[var(--lxxl-green-dark)]"
                    : "border-[var(--lxxl-border)] bg-white hover:border-[var(--lxxl-green)]"
                }`}
                type="button"
                onClick={() => setActiveTab(item.value)}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">
                  {item.description} · {count} 条
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        {listLoading && activeRows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载咨询明细...
          </div>
        )}
        {activeRows.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载咨询明细..." : "暂无咨询明细。"} />
        ) : filteredRows.length === 0 ? (
          <EmptyState text="没有符合筛选条件的咨询明细。" />
        ) : (
          <div className="divide-y divide-[var(--lxxl-border)]">
            {filteredRows.map((item) => {
              const active = activeDetailId === item.id;
              return (
                <article key={`${activeTab}-${item.id}`} className="py-4">
                  <button
                    className="flex w-full items-start justify-between gap-4 text-left text-sm"
                    type="button"
                    onClick={() => setActiveDetailId(active ? null : item.id)}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-[#2C2C2C]">
                        {patientTitle(item)}
                        {item.patientMobile ? (
                          <span className="ml-2 font-normal text-[var(--lxxl-muted)]">{item.patientMobile}</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--lxxl-muted)]">
                        {formatDateTime(item.subtitle)}
                        {item.status ? ` · ${statusLabel(item.status)}` : ""}
                        {item.amount != null ? ` · ${formatMoneyFromCents(item.amount)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--lxxl-green)]">
                      {active ? "收起" : "查看详情"}
                    </span>
                  </button>
                  {active && <ConsultationDetail item={item} />}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ConsultationDetail({ item }: { item: CounselorDashboardDetailItem }) {
  return (
    <div className="mt-3 rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6">
      <div className="grid gap-1 text-[var(--lxxl-muted)]">
        <DetailLine
          label="来访者"
          value={item.patientMobile ? `${patientTitle(item)} ${item.patientMobile}` : patientTitle(item)}
        />
        <DetailLine label="时间" value={formatDateTime(item.subtitle)} />
        <DetailLine label="状态" value={statusLabel(item.status)} />
        {item.amount != null && <DetailLine label="金额" value={formatMoneyFromCents(item.amount)} />}
        {item.extra && <DetailLine label="补充信息" value={item.extra} />}
        {item.consultationId != null && <DetailLine label="关联咨询" value={`咨询单 ${item.consultationId}`} />}
        {item.caseRecordId != null && <DetailLine label="关联记录" value={`咨询记录 ${item.caseRecordId}`} />}
      </div>
      {(item.consultationId != null || item.caseRecordId != null) && (
        <div className="mt-3">
          <TableActionButton onClick={() => openCounselorRecord(item)}>
            {item.caseRecordId != null ? "查看咨询记录" : "填写咨询记录"}
          </TableActionButton>
        </div>
      )}
    </div>
  );
}

function patientTitle(item: CounselorDashboardDetailItem) {
  return formatPatientNameWithContractTag(item.title, item.patientContractTag);
}

function DetailLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-3">
      <span>{label}</span>
      <span className="text-[#2C2C2C]">{value || "-"}</span>
    </div>
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
