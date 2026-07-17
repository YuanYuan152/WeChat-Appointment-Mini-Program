import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  RISK_ASSESSMENT_ITEMS,
  formatRiskChoiceDisplay,
  normalizeRiskAssessment,
  normalizeRiskChoice,
} from "@/constants/caseRecordRiskAssessment";
import { API_BASE_URL } from "@/lib/api";
import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { CounselorCaseRecord, CounselorDashboardDetailItem } from "@/types/api";
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
  recordLoading,
  selectedRecord,
  selectedRecordItem,
  setPeriod,
  onCloseRecord,
  onOpenRecord,
  onSearch,
  onReset,
}: {
  details?: CounselorDashboardDetailItem[];
  listLoading: boolean;
  period: CounselorDashboardPeriod;
  recordLoading: boolean;
  selectedRecord?: CounselorCaseRecord;
  selectedRecordItem?: CounselorDashboardDetailItem;
  setPeriod: (value: CounselorDashboardPeriod) => void;
  onCloseRecord: () => void;
  onOpenRecord: (item: CounselorDashboardDetailItem) => void;
  onSearch: () => void;
  onReset: () => void;
}) {
  const [patientKeywordDraft, setPatientKeywordDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("ALL");
  const [patientKeyword, setPatientKeyword] = useState("");
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
    const normalizedKeyword = patientKeyword.trim().toLowerCase();
    return rows.filter((item) => {
      if (status !== "ALL" && item.status !== status) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      return [item.title, item.patientMobile]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
    });
  }, [patientKeyword, rows, status]);

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
          setPatientKeyword(patientKeywordDraft.trim());
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
          <QueryField label="来访者">
            <input
              className={queryControlClass}
              placeholder="请输入来访者姓名或手机号"
              value={patientKeywordDraft}
              onChange={(event) => setPatientKeywordDraft(event.target.value)}
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
              setPatientKeywordDraft("");
              setStatusDraft("ALL");
              setPatientKeyword("");
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
                    <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--lxxl-border)]">
                      <table className="w-full min-w-[920px] border-collapse text-sm">
                        <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                          <tr>
                            <th className="px-4 py-3 font-medium">咨询时间</th>
                            <th className="px-4 py-3 font-medium">状态</th>
                            <th className="px-4 py-3 font-medium">订单收入</th>
                            <th className="px-4 py-3 font-medium">个人收入</th>
                            <th className="px-4 py-3 font-medium">咨询记录</th>
                            <th className="px-4 py-3 font-medium">咨询单</th>
                            <th className="px-4 py-3 text-right font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <OrderDetailRow key={item.id} item={item} onOpenRecord={onOpenRecord} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {selectedRecordItem && (
        <DetailDrawer title="咨询记录详情" onClose={onCloseRecord}>
          {recordLoading || !selectedRecord ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载咨询记录...</div>
          ) : (
            <CounselorOrderRecordDetail item={selectedRecordItem} record={selectedRecord} />
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function OrderDetailRow({
  item,
  onOpenRecord,
}: {
  item: CounselorDashboardDetailItem;
  onOpenRecord: (item: CounselorDashboardDetailItem) => void;
}) {
  const hasRecord = item.caseRecordStatus === "FILLED" || Boolean(item.caseRecordId);

  return (
    <tr className="border-t border-[var(--lxxl-border)] align-middle">
      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#2C2C2C]">{formatDateTime(item.subtitle)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[var(--lxxl-muted)]">{statusLabel(item.status)}</td>
      <td className="whitespace-nowrap px-4 py-3">{formatMoneyFromCents(item.amount)}</td>
      <td className="whitespace-nowrap px-4 py-3">{formatMoneyFromCents(item.personalIncome)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[var(--lxxl-muted)]">{hasRecord ? "已填写" : "待填写"}</td>
      <td className="px-4 py-3 text-[var(--lxxl-muted)]">{item.extra || "-"}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <TableActionButton onClick={() => (hasRecord ? onOpenRecord(item) : openCounselorRecord(item))}>
          {hasRecord ? "查看记录" : "去填写"}
        </TableActionButton>
      </td>
    </tr>
  );
}

function CounselorOrderRecordDetail({
  item,
  record,
}: {
  item: CounselorDashboardDetailItem;
  record: CounselorCaseRecord;
}) {
  const riskAssessment = record.RiskAssessment ? normalizeRiskAssessment(record.RiskAssessment) : null;
  const headerInfo = Object.entries(record.HeaderInfo || {}).filter(([, value]) => String(value || "").trim());

  return (
    <div className="space-y-5 text-sm">
      <section className="border-b border-[var(--lxxl-border)] pb-4">
        <div className="text-base font-semibold text-[#2C2C2C]">{item.title}</div>
        <div className="mt-2 text-[var(--lxxl-muted)]">
          {formatDateTime(item.subtitle)} · {statusLabel(item.status)} · {item.extra || `咨询单 #${record.ConsultationId}`}
        </div>
      </section>
      <RecordContent title="患者情况记录（主观陈述）" value={record.Subjective} />
      <RecordContent title="客观观察" value={record.Objective} />
      <RecordContent title="评估分析" value={record.Assessment} />
      <RecordContent title="计划方向" value={record.Plan} />
      <section className="border-t border-[var(--lxxl-border)] pt-4">
        <h4 className="font-semibold">风险/危机评估</h4>
        {riskAssessment ? (
          <div className="mt-3 space-y-2">
            {RISK_ASSESSMENT_ITEMS.map((riskItem) => {
              const entry = riskAssessment.items[riskItem.id];
              const choice = normalizeRiskChoice(entry?.choice || "", riskItem.id);
              return (
                <div key={riskItem.id} className="rounded-xl bg-[#FAF8F4] px-3 py-2 leading-6">
                  <div className="font-medium text-[#2C2C2C]">
                    {riskItem.index}. {riskItem.label}
                  </div>
                  <div className="mt-1 text-[var(--lxxl-muted)]">
                    {choice ? formatRiskChoiceDisplay(riskItem.id, choice, entry?.note || "") : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 text-[var(--lxxl-muted)]">暂无风险评估</div>
        )}
      </section>
      {headerInfo.length > 0 && (
        <section className="border-t border-[var(--lxxl-border)] pt-4">
          <h4 className="font-semibold">表头信息</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {headerInfo.map(([key, value]) => (
              <div key={key} className="rounded-xl bg-[#FAF8F4] px-3 py-2">
                <div className="text-xs text-[var(--lxxl-muted)]">{recordHeaderLabel(key)}</div>
                <div className="mt-1 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {(record.PhotoUrls || []).length > 0 && (
        <section className="border-t border-[var(--lxxl-border)] pt-4">
          <h4 className="font-semibold">相关照片</h4>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {record.PhotoUrls.filter(Boolean).map((url) => (
              <a
                key={url}
                className="relative block aspect-square overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4]"
                href={normalizeRecordPhotoUrl(url)}
                rel="noreferrer"
                target="_blank"
              >
                <Image
                  fill
                  unoptimized
                  alt="咨询相关照片"
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 160px"
                  src={normalizeRecordPhotoUrl(url)}
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecordContent({ title, value }: { title: string; value?: string | null }) {
  return (
    <section className="border-t border-[var(--lxxl-border)] pt-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="mt-3 whitespace-pre-wrap leading-7 text-[var(--lxxl-muted)]">{value || "-"}</div>
    </section>
  );
}

function recordHeaderLabel(key: string) {
  return {
    code: "代码",
    gender: "性别",
    consult_method: "咨询方式",
    session_number: "咨询次数",
    start_year: "咨询开始年份",
    start_month: "咨询开始月份",
    start_day: "咨询开始日期",
    start_hour: "咨询开始小时",
    start_minute: "咨询开始分钟",
    end_hour: "咨询结束小时",
    end_minute: "咨询结束分钟",
  }[key] || key;
}

function normalizeRecordPhotoUrl(url: string) {
  const value = url.trim();
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
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
