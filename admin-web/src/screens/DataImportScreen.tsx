"use client";

import { useMemo, useRef, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { Badge, EmptyState, PanelHeader, QueryButton, QueryResetButton } from "@/components/ui";
import { formatFullDateTime, formatMoneyFromCents } from "@/lib/format";
import { importCompletedOrders } from "@/services/imports";
import type { CompletedOrderImportResult, CompletedOrderImportRowResult, CompletedOrderImportStatus } from "@/types/api";

const REQUIRED_HEADERS = [
  "日期",
  "星期",
  "时间",
  "咨询师",
  "来访者",
  "付费状况",
  "付费时间",
  "付费方式",
  "付费金额",
  "取消备注",
  "形式",
  "地点",
  "咨询室",
  "次数",
  "咨询时数",
  "备注",
  "助理",
  "目前阶段",
  "最后咨询次数",
  "总时长",
  "合计收入",
];

const statusConfig: Record<CompletedOrderImportStatus, { label: string; tone: "green" | "gold" | "red" }> = {
  IMPORTED: { label: "已导入", tone: "green" },
  SKIPPED: { label: "已跳过", tone: "gold" },
  FAILED: { label: "失败", tone: "red" },
};

export function DataImportScreen() {
  return (
    <AppRoute sectionId="dataImport">
      <DataImportContent />
    </AppRoute>
  );
}

function DataImportContent() {
  const { clearNotice, setLoading, showNotice } = useAppRoute();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CompletedOrderImportResult | null>(null);

  const hasRows = Boolean(result?.rows.length);

  const sortedRows = useMemo(() => {
    if (!result) {
      return [];
    }
    return [...result.rows].sort((left, right) => {
      const order = { FAILED: 0, IMPORTED: 1, SKIPPED: 2 };
      return order[left.status] - order[right.status] || left.rowNumber - right.rowNumber;
    });
  }, [result]);

  const handleSubmit = async () => {
    if (!file) {
      showNotice("error", "请先选择需要导入的 .xlsx 文件");
      return;
    }
    clearNotice();
    setLoading(true);
    try {
      const response = await importCompletedOrders(file);
      setResult(response);
      showNotice(response.failedCount > 0 ? "info" : "success", response.message || "导入完成");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "导入失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    clearNotice();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="数据导入"
        description="按模板导入历史客户记录；每一行客户记录会写入为一条已支付、已完成的咨询订单。"
      />

      <div className="space-y-6 px-6 py-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div>
            <h3 className="text-sm font-semibold">导入规则</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              系统会复用现有用户、角色、排期、订单和咨询单表。未找到来访者时会按姓名创建来访账号；
              一条客户记录会导入为一条已支付、已完成的订单记录。未找到咨询师、地点无法识别或同时间已有咨询时，
              该行会标记失败并继续处理下一行。
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
              Excel 第一行需包含以下全部表头；星期、备注及累计统计字段可以留空，但表头需要保留。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {REQUIRED_HEADERS.map((header) => (
                <span
                  key={header}
                  className="rounded-full bg-[#FAF8F4] px-3 py-1 text-xs font-medium text-[var(--lxxl-muted)]"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] p-4">
            <label className="block text-xs font-medium text-[var(--lxxl-muted)]">
              Excel 文件 <span className="ml-1 text-[#B34B43]">*</span>
            </label>
            <input
              ref={inputRef}
              accept=".xlsx"
              className="mt-2 block w-full cursor-pointer rounded-xl border border-[var(--lxxl-border)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--lxxl-green)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              type="file"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResult(null);
              }}
            />
            <div className="mt-3 text-xs leading-5 text-[var(--lxxl-muted)]">
              {file ? `已选择：${file.name}` : "仅支持 .xlsx 文件。"}
            </div>
            <div className="mt-4 flex gap-3">
              <QueryButton disabled={!file} onClick={handleSubmit}>
                开始导入
              </QueryButton>
              <QueryResetButton onClick={handleReset}>重置</QueryResetButton>
            </div>
          </div>
        </div>

        {result && (
          <div className="grid gap-3 sm:grid-cols-4">
            <ImportStat label="总行数" value={result.totalRows} />
            <ImportStat label="成功导入" value={result.importedCount} tone="green" />
            <ImportStat label="跳过" value={result.skippedCount} tone="gold" />
            <ImportStat label="失败" value={result.failedCount} tone="red" />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--lxxl-border)]">
        {!hasRows ? (
          <EmptyState text="导入后会在这里展示每一行的处理结果。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-[#FAF8F4] text-xs text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3">行号</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">来访者</th>
                  <th className="px-5 py-3">咨询师</th>
                  <th className="px-5 py-3">咨询时间</th>
                  <th className="px-5 py-3">金额</th>
                  <th className="px-5 py-3">结果说明</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <ImportResultRow key={`${row.rowNumber}-${row.status}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ImportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "gold" | "red";
}) {
  const toneClass = {
    green: "text-[var(--lxxl-green)]",
    gold: "text-[#967342]",
    red: "text-[#A13F37]",
  }[tone || "green"];

  return (
    <div className="rounded-xl bg-[#FAF8F4] p-4">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone ? toneClass : ""}`}>{value}</div>
    </div>
  );
}

function ImportResultRow({ row }: { row: CompletedOrderImportRowResult }) {
  const status = statusConfig[row.status];
  const timeRange =
    row.startTime || row.endTime
      ? `${formatFullDateTime(row.startTime)} 至 ${formatFullDateTime(row.endTime)}`
      : "-";

  return (
    <tr className="border-t border-[var(--lxxl-border)] align-top">
      <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">{row.rowNumber}</td>
      <td className="whitespace-nowrap px-5 py-4">
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>
      <td className="px-5 py-4">{row.patientName || "-"}</td>
      <td className="px-5 py-4">{row.counselorName || "-"}</td>
      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{timeRange}</td>
      <td className="whitespace-nowrap px-5 py-4">
        {row.amount == null ? "-" : formatMoneyFromCents(row.amount)}
      </td>
      <td className="px-5 py-4 text-[var(--lxxl-muted)]">
        <div>{row.message}</div>
        {(row.orderId || row.consultationId) && (
          <div className="mt-1 text-xs">
            已生成{row.orderId ? "订单" : ""}
            {row.orderId && row.consultationId ? "和" : ""}
            {row.consultationId ? "咨询记录" : ""}
          </div>
        )}
      </td>
    </tr>
  );
}
