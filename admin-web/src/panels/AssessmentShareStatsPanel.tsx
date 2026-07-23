"use client";

import type { Dispatch, SetStateAction } from "react";

import {
  EmptyState,
  MiniStat,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";
import { formatAssessmentConversionRate } from "@/lib/assessmentShareStats";
import type {
  AssessmentShareStats,
  AssessmentShareStatsFilters,
} from "@/types/assessmentShareStats";

export function AssessmentShareStatsPanel({
  stats,
  loading,
  error,
  draftFilters,
  setDraftFilters,
  onSearch,
  onReset,
}: {
  stats?: AssessmentShareStats;
  loading: boolean;
  error?: string;
  draftFilters: AssessmentShareStatsFilters;
  setDraftFilters: Dispatch<SetStateAction<AssessmentShareStatsFilters>>;
  onSearch: () => void;
  onReset: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal">量表分享统计</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            查看二维码扫码、近似独立访问和分享归因完成情况。同周期扫码完成比按所选时间内的归因完成报告数除以扫码事件数计算。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <QueryField label="量表 ID">
            <input
              className={queryControlClass}
              maxLength={80}
              placeholder="输入量表 ID"
              value={draftFilters.assessmentId || ""}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  assessmentId: event.target.value,
                }))
              }
            />
          </QueryField>
          <QueryField label="统计日期（开始）">
            <input
              className={queryControlClass}
              type="date"
              value={draftFilters.startAt || ""}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  startAt: event.target.value,
                }))
              }
            />
          </QueryField>
          <QueryField label="统计日期（结束）">
            <input
              className={queryControlClass}
              type="date"
              value={draftFilters.endAt || ""}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  endAt: event.target.value,
                }))
              }
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton
            className="disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            type="submit"
          />
          <QueryResetButton
            className="disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={onReset}
          />
        </div>
      </form>

      <div className="relative border-t border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        {loading && stats && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在更新分享统计...
          </div>
        )}
        {error && stats && (
          <div className="mb-4 rounded-xl border border-[#E8B6B0] bg-[#FFF6F4] px-4 py-3 text-sm text-[#A13F37]">
            {error}
          </div>
        )}
        {!stats ? (
          <EmptyState
            text={
              loading
                ? "正在加载分享统计..."
                : error || "暂无分享统计。"
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="二维码扫码"
                value={`${formatCount(stats.scanCount)} 次`}
              />
              <MiniStat
                label="近似独立扫码"
                value={`${formatCount(stats.uniqueScanCount)} 个`}
              />
              <MiniStat
                label="分享归因完成"
                value={`${formatCount(stats.completedReportCount)} 份`}
              />
              <MiniStat
                label="同周期扫码完成比"
                value={formatAssessmentConversionRate(stats.conversionRate)}
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-[var(--lxxl-muted)]">
              近似独立扫码根据匿名 cookie 计算，不等同于真实自然人数；同一浏览器 30 秒内重复打开同一量表不会重复计数。同周期扫码完成比不是同一批访客的严格漏斗转化率。
            </p>

            {stats.items.length === 0 ? (
              <div className="-mx-6 mt-5 border-t border-[var(--lxxl-border)] sm:-mx-7 lg:-mx-8">
                <EmptyState text="当前条件下暂无量表分享数据。" />
              </div>
            ) : (
              <div className="-mx-6 mt-5 overflow-x-auto border-t border-[var(--lxxl-border)] sm:-mx-7 lg:-mx-8">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">量表</th>
                      <th className="px-5 py-3 font-medium">二维码扫码</th>
                      <th className="px-5 py-3 font-medium">近似独立扫码</th>
                      <th className="px-5 py-3 font-medium">分享归因完成</th>
                      <th className="px-5 py-3 font-medium">
                        同周期扫码完成比
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.items.map((item) => (
                      <tr
                        className="border-t border-[var(--lxxl-border)]"
                        key={item.assessmentId}
                      >
                        <td className="max-w-[320px] px-5 py-4">
                          <div className="font-medium">
                            {item.assessmentTitle}
                          </div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            {item.assessmentId}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {formatCount(item.scanCount)} 次
                        </td>
                        <td className="px-5 py-4">
                          {formatCount(item.uniqueScanCount)} 个
                        </td>
                        <td className="px-5 py-4">
                          {formatCount(item.completedReportCount)} 份
                        </td>
                        <td className="px-5 py-4 font-medium text-[var(--lxxl-green-dark)]">
                          {formatAssessmentConversionRate(
                            item.conversionRate,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function formatCount(value: number) {
  return Number.isFinite(value) && value >= 0
    ? value.toLocaleString("zh-CN")
    : "-";
}
