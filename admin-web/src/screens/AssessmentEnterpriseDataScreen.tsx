"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { resolveImageUrl } from "@/components/content/ContentImageUpload";
import { DataCard, EmptyHint, ProgressBar, StatCard } from "@/components/enterpriseData/ui";
import { queryControlClass } from "@/components/ui";
import { chinaDateTimeText, formatPercent, ratio } from "@/lib/enterpriseData";
import { fetchEnterpriseDataSummaries } from "@/services/enterpriseData";
import type { EnterpriseDataSummary } from "@/types/enterpriseData";

export function AssessmentEnterpriseDataScreen() {
  return (
    <AppRoute sectionId="assessmentEnterpriseData">
      <AssessmentEnterpriseDataContent />
    </AppRoute>
  );
}

function AssessmentEnterpriseDataContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [items, setItems] = useState<EnterpriseDataSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      setItems(await fetchEnterpriseDataSummaries());
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "企业数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, showNotice]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const totals = useMemo(
    () => ({
      respondents: items.reduce((sum, item) => sum + item.respondentCount, 0),
      reports: items.reduce((sum, item) => sum + item.reportCount, 0),
      risk: items.reduce((sum, item) => sum + item.riskRespondentCount, 0),
      pending: items.reduce((sum, item) => sum + item.pendingAlertCount, 0),
    }),
    [items],
  );

  const visible = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const filtered = normalized
      ? items.filter((item) =>
          `${item.companyName} ${item.siteName} ${item.slug}`.toLowerCase().includes(normalized),
        )
      : items;
    return [...filtered].sort(
      (left, right) =>
        right.pendingAlertCount - left.pendingAlertCount
        || (right.latestAt || "").localeCompare(left.latestAt || "")
        || left.companyName.localeCompare(right.companyName, "zh-CN"),
    );
  }, [items, keyword]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white px-6 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">企业定制数据管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--lxxl-muted)]">
              汇总每个企业专属链接下员工填写的基本信息与量表结果，进入单个企业后可查看数据概览、分析报告、风险提醒、员工档案、答卷明细与人工标注。
            </p>
          </div>
          <button
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
            type="button"
            onClick={() => router.push("/assessment-enterprises")}
          >
            前往企业定制配置
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="企业链接" note="已配置的企业专属链接" unit="个" value={items.length} />
        <StatCard label="累计填写人数" note={`共 ${totals.reports} 份答卷`} unit="人" value={totals.respondents} />
        <StatCard label="中高风险人数" note="按每人最近一次答卷统计" tone={totals.risk ? "risk" : "default"} unit="人" value={totals.risk} />
        <StatCard label="待处理风险答卷" note="未标记为已缓解 / 无需跟进" tone={totals.pending ? "risk" : "good"} unit="份" value={totals.pending} />
      </div>

      <DataCard
        right={
          <input
            aria-label="搜索企业"
            className={`${queryControlClass} w-64`}
            placeholder="搜索公司名 / 网站名 / 链接后缀"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        }
        sub="按待处理风险与最近填写时间排序"
        title="企业链接"
      >
        {loading && items.length === 0 ? (
          <EmptyHint text="正在加载企业数据..." />
        ) : visible.length === 0 ? (
          <EmptyHint text={items.length === 0 ? "暂无企业定制链接，请先在「企业定制」中创建。" : "没有匹配的企业。"} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((item) => (
              <EnterpriseCard key={item.id} item={item} onOpen={() => router.push(`/assessment-enterprise-data/${encodeURIComponent(item.id)}`)} />
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

function EnterpriseCard({ item, onOpen }: { item: EnterpriseDataSummary; onOpen: () => void }) {
  const coverage = item.personnelEmployeeCount > 0 ? ratio(item.respondentCount, item.personnelEmployeeCount) : null;
  return (
    <article className="flex flex-col rounded-xl border border-[var(--lxxl-border)] bg-[#FDFCFA] p-5 transition hover:border-[var(--lxxl-green)] hover:shadow-[0_8px_24px_rgba(61,90,78,0.08)]">
      <div className="flex items-start gap-3">
        {item.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-11 w-11 shrink-0 rounded-lg border border-[var(--lxxl-border)] bg-white object-contain p-1" src={resolveImageUrl(item.logoUrl)} />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#EAF2ED] text-base font-semibold text-[var(--lxxl-green)]">
            {(item.companyName || "企").slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{item.companyName || "未命名企业"}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--lxxl-muted)]">
            {item.siteName} · 授权量表 {item.assessmentCount} 个
          </div>
        </div>
        {item.pendingAlertCount > 0 && (
          <span className="shrink-0 rounded-full bg-[#FBE8E6] px-2.5 py-1 text-xs font-medium text-[#B3261E]">
            待处理 {item.pendingAlertCount}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="填写人数" value={item.respondentCount} />
        <Metric label="答卷数" value={item.reportCount} />
        <Metric danger={item.riskRespondentCount > 0} label="中高风险" value={item.riskRespondentCount} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--lxxl-muted)]">
          <span>{item.personnelEmployeeCount > 0 ? `人员表 ${item.personnelEmployeeCount} 人` : "未生成人员表（匿名填写）"}</span>
          <span>{coverage === null ? "" : `覆盖 ${formatPercent(coverage)}`}</span>
        </div>
        <ProgressBar max={1} value={coverage ?? 0} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--lxxl-border)] pt-3">
        <span className="text-xs text-[var(--lxxl-muted)]">
          {item.latestAt ? `最近填写 ${chinaDateTimeText(item.latestAt)}` : "尚无填写记录"}
        </span>
        <button
          className="h-9 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]"
          type="button"
          onClick={onOpen}
        >
          进入数据管理
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-2 py-2.5">
      <div className={`text-xl font-semibold ${danger ? "text-[#B3261E]" : "text-[var(--lxxl-text)]"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--lxxl-muted)]">{label}</div>
    </div>
  );
}
