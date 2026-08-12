"use client";

import { useEffect, useRef, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import {
  Badge,
  EmptyState,
  PanelHeader,
  QueryButton,
  QueryField,
  QueryResetButton,
  queryControlClass,
} from "@/components/ui";
import {
  downloadDataTransferTemplate,
  exportDataTransfer,
  importDataTransfer,
} from "@/services/imports";
import type {
  DataTransferImportResult,
  DataTransferKind,
} from "@/types/api";

const KINDS: DataTransferKind[] = ["visitors", "counselors", "orders"];
const HISTORY_LIMIT = 8;

const KIND_CONFIG: Record<
  DataTransferKind,
  { label: string; description: string; rules: string[]; filename: string }
> = {
  visitors: {
    label: "来访用户信息表",
    description: "批量维护来访者基础资料。",
    rules: [
      "请先下载最新模板，保持工作表名称和表头不变。",
      "每行填写一位来访者；必填项、格式和可选值以模板中的说明为准。",
      "来访手机号与数据库或同一文件中已成功导入的手机号重复时，该行不会导入。",
      "错误行或重复行仅拒绝该行，其他合格行会继续导入；请根据下方工作表、单元格和问题修正后重试。",
    ],
    filename: "来访用户信息表",
  },
  counselors: {
    label: "咨询师用户信息表",
    description: "批量维护咨询师账号及资料。",
    rules: [
      "请使用本页下载的最新模板，不要删除或重命名工作表及表头。",
      "每行填写一位咨询师；必填项、格式和可选值以模板中的说明为准。",
      "咨询师手机号与数据库或同一文件中已成功导入的手机号重复时，该行不会导入。",
      "错误行或重复行仅拒绝该行，其他合格行会继续导入；请根据下方工作表、单元格和问题修正后重试。",
    ],
    filename: "咨询师用户信息表",
  },
  orders: {
    label: "咨询订单信息表",
    description: "批量维护预约及订单数据。",
    rules: [
      "请使用最新订单模板，并保持工作表名称、表头和日期时间格式不变。",
      "导入前请确认来访者、咨询师及预约时间等关联信息准确，具体约束以模板说明为准。",
      "来访电话、咨询师电话与咨询时间三项和数据库或同一文件中的订单重复时，该行不会导入。",
      "错误行或重复行仅拒绝该行，其他合格行会继续导入；订单导出必须选择预约开始日期范围。",
    ],
    filename: "咨询订单信息表",
  },
};

interface ImportHistoryItem {
  id: string;
  importedAt: string;
  fileName: string;
  success: boolean;
  summary: string;
}

type KindFiles = Record<DataTransferKind, File | null>;
type KindResults = Record<DataTransferKind, DataTransferImportResult | null>;
type KindHistory = Record<DataTransferKind, ImportHistoryItem[]>;

const emptyFiles = (): KindFiles => ({ visitors: null, counselors: null, orders: null });
const emptyResults = (): KindResults => ({ visitors: null, counselors: null, orders: null });
const emptyHistory = (): KindHistory => ({ visitors: [], counselors: [], orders: [] });

function historyKey(kind: DataTransferKind) {
  return `lxxl_admin_data_transfer_history_${kind}`;
}

function readHistory(kind: DataTransferKind): ImportHistoryItem[] {
  try {
    const value = window.localStorage.getItem(historyKey(kind));
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ImportHistoryItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "importedAt" in item &&
            "fileName" in item &&
            "success" in item &&
            "summary" in item,
        ),
    ).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function timestampForFilename() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "-").replace("T", "_");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

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
  const [activeKind, setActiveKind] = useState<DataTransferKind | null>(null);
  const [files, setFiles] = useState<KindFiles>(emptyFiles);
  const [results, setResults] = useState<KindResults>(emptyResults);
  const [history, setHistory] = useState<KindHistory>(emptyHistory);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busyAction, setBusyAction] = useState<"template" | "import" | "export" | null>(null);

  const config = activeKind ? KIND_CONFIG[activeKind] : null;
  const file = activeKind ? files[activeKind] : null;
  const result = activeKind ? results[activeKind] : null;
  const hasType = activeKind !== null;

  useEffect(() => {
    setHistory({
      visitors: readHistory("visitors"),
      counselors: readHistory("counselors"),
      orders: readHistory("orders"),
    });
  }, []);

  const runBusy = async (
    action: "template" | "import" | "export",
    work: () => Promise<void>,
  ) => {
    clearNotice();
    setBusyAction(action);
    setLoading(true);
    try {
      await work();
    } catch (error) {
      throw error;
    } finally {
      setBusyAction(null);
      setLoading(false);
    }
  };

  const addHistory = (
    kind: DataTransferKind,
    item: Omit<ImportHistoryItem, "id" | "importedAt">,
  ) => {
    const entry: ImportHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      importedAt: new Date().toISOString(),
    };
    setHistory((current) => {
      const nextItems = [entry, ...current[kind]].slice(0, HISTORY_LIMIT);
      window.localStorage.setItem(historyKey(kind), JSON.stringify(nextItems));
      return { ...current, [kind]: nextItems };
    });
  };

  const handleTemplateDownload = async () => {
    if (!activeKind || !config) {
      showNotice("error", "请先选择导入&导出类型");
      return;
    }
    try {
      await runBusy("template", async () => {
        const response = await downloadDataTransferTemplate(activeKind);
        saveFile(response.blob, response.filename || `${config.filename}导入模板.xlsx`);
        showNotice("success", "模板下载已开始");
      });
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "模板下载失败");
    }
  };

  const handleSelectedFileDownload = () => {
    if (!file) {
      showNotice("error", "请先选择导入的文件");
      return;
    }
    saveFile(file, file.name);
  };

  const handleImport = async () => {
    if (!activeKind || !config) {
      showNotice("error", "请先选择导入&导出类型");
      return;
    }
    if (!file) {
      showNotice("error", "请先选择需要导入的 .xlsx 文件");
      return;
    }
    try {
      await runBusy("import", async () => {
        const response = await importDataTransfer(activeKind, file);
        setResults((current) => ({ ...current, [activeKind]: response }));
        const unsuccessfulCount = response.rejectedCount + response.failedCount;
        const summary = `共 ${response.totalRows} 行，导入 ${response.importedCount} 行，拒绝 ${response.rejectedCount} 行，失败 ${response.failedCount} 行`;
        addHistory(activeKind, {
          fileName: file.name,
          success: unsuccessfulCount === 0,
          summary,
        });
        showNotice(unsuccessfulCount > 0 ? "info" : "success", response.message || "导入完成");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      addHistory(activeKind, { fileName: file.name, success: false, summary: message });
      showNotice("error", message);
    }
  };

  const handleExport = async () => {
    if (!activeKind || !config) {
      showNotice("error", "请先选择导入&导出类型");
      return;
    }
    if (activeKind === "orders") {
      if (!startDate || !endDate) {
        showNotice("error", "请选择预约开始日期的开始和结束日期");
        return;
      }
      if (startDate > endDate) {
        showNotice("error", "开始日期不能晚于结束日期");
        return;
      }
    }
    try {
      await runBusy("export", async () => {
        const response = await exportDataTransfer(
          activeKind,
          activeKind === "orders" ? { startDate, endDate } : undefined,
        );
        saveFile(
          response.blob,
          response.filename || `${config.filename}导出_${timestampForFilename()}.xlsx`,
        );
        showNotice("success", "数据导出已开始");
      });
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "数据导出失败");
    }
  };

  const clearSelectedFile = () => {
    if (!activeKind || busyAction !== null) return;
    setFiles((current) => ({ ...current, [activeKind]: null }));
    setResults((current) => ({ ...current, [activeKind]: null }));
    if (inputRef.current) inputRef.current.value = "";
  };

  const changeKind = (kind: DataTransferKind | "") => {
    if (!kind) {
      setActiveKind(null);
      clearNotice();
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setActiveKind(kind);
    clearNotice();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="数据导入&导出"
        description="请先选择导入&导出类型，再下载模板或选择 Excel 文件导入；也可按类型导出备份。"
      />

      <div className="space-y-6 px-6 py-5">
        <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lxxl-green)] text-xs font-semibold text-white">
              1
            </span>
            <h3 className="text-sm font-semibold">选择导入&导出类型</h3>
            <span className="text-xs text-[#B34B43]">*必选</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
            进入本页后请先在此选择要处理的数据类型；未选择时「选择导入的文件」「下载并导出表格」按钮不可用。
          </p>
          <label className="mt-4 block text-xs font-medium text-[var(--lxxl-muted)]">
            导入&导出类型 <span className="ml-1 text-[#B34B43]">*</span>
          </label>
          <select
            aria-label="选择导入&导出类型"
            className={`${queryControlClass} mt-2 max-w-md`}
            value={activeKind ?? ""}
            onChange={(event) => changeKind(event.target.value as DataTransferKind | "")}
          >
            <option value="">请选择导入&导出类型</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_CONFIG[kind].label}
              </option>
            ))}
          </select>
        </div>

        {!hasType || !config ? null : (
          <div>
            <h3 className="text-sm font-semibold">{config.label}导入规则</h3>
            <p className="mt-1 text-sm text-[var(--lxxl-muted)]">{config.description}</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--lxxl-muted)]">
              {config.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
            <QueryResetButton
              className="mt-4 w-auto"
              disabled={busyAction !== null}
              onClick={handleTemplateDownload}
            >
              {busyAction === "template" ? "下载中..." : "下载 Excel 模板"}
            </QueryResetButton>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl bg-[#FAF8F4] p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lxxl-green)] text-xs font-semibold text-white">
                2
              </span>
              <h3 className="text-sm font-semibold">数据导入</h3>
            </div>

            <label className="mt-4 block text-xs font-medium text-[var(--lxxl-muted)]">
              选择导入的文件 <span className="ml-1 text-[#B34B43]">*</span>
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex items-center rounded-lg bg-[var(--lxxl-green)] px-3 py-1.5 text-sm font-medium text-white transition ${
                  !hasType || busyAction !== null
                    ? "pointer-events-none cursor-not-allowed opacity-45"
                    : "cursor-pointer hover:opacity-90"
                }`}
                title={!hasType ? "请先选择导入&导出类型" : undefined}
              >
                选择导入的文件
                <input
                  key={activeKind ?? "none"}
                  ref={inputRef}
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={!hasType || busyAction !== null}
                  type="file"
                  onChange={(event) => {
                    if (!activeKind) return;
                    const selected = event.target.files?.[0] || null;
                    if (selected && !selected.name.toLowerCase().endsWith(".xlsx")) {
                      event.target.value = "";
                      showNotice("error", "仅支持 .xlsx 文件");
                      return;
                    }
                    setFiles((current) => ({ ...current, [activeKind]: selected }));
                    setResults((current) => ({ ...current, [activeKind]: null }));
                  }}
                />
              </label>
              <span className="min-w-0 flex-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                {!hasType
                  ? "请先选择导入&导出类型后再选择文件"
                  : file
                    ? "已选择 1 个文件"
                    : "未选择文件（仅支持 .xlsx）"}
              </span>
            </div>

            {file ? (
              <>
                <div className="relative mt-4 rounded-lg border border-[var(--lxxl-border)] bg-white px-4 py-3 pr-11">
                  <button
                    className="block max-w-full break-all text-left text-sm font-medium text-[var(--lxxl-green)] underline underline-offset-2 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={busyAction !== null}
                    title="下载所选原文件"
                    type="button"
                    onClick={handleSelectedFileDownload}
                  >
                    {file.name}
                  </button>
                  <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
                    {formatFileSize(file.size)}
                  </p>
                  <button
                    aria-label={`删除文件 ${file.name}`}
                    className="absolute right-3 top-2 text-xl leading-none text-[#B34B43] hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={busyAction !== null}
                    title="删除文件"
                    type="button"
                    onClick={clearSelectedFile}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-4">
                <QueryButton disabled={busyAction !== null} onClick={handleImport}>
                  {busyAction === "import" ? "导入中..." : "开始导入"}
                </QueryButton>
                </div>
              </>
            ) : (
              <p className="mt-4 text-xs text-[var(--lxxl-muted)]">
                {hasType
                  ? "选择文件后，将显示文件卡片和「开始导入」。"
                  : "选择导入&导出类型并选择文件后，将显示文件卡片和「开始导入」。"}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-[#FAF8F4] p-4">
            <h3 className="text-sm font-semibold">数据导出</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
              {!hasType || !config
                ? "请先选择导入&导出类型，再下载并导出对应表格。"
                : activeKind === "orders"
                  ? "按预约开始日期范围导出咨询订单信息表，开始和结束日期均包含在范围内。"
                  : `下载并导出当前系统中的全部${config.label}。`}
            </p>
            {activeKind === "orders" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <QueryField label="预约开始日期（起）" required>
                  <input
                    className={queryControlClass}
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </QueryField>
                <QueryField label="预约开始日期（止）" required>
                  <input
                    className={queryControlClass}
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </QueryField>
              </div>
            )}
            <QueryButton
              className={`mt-4 w-auto ${!hasType || busyAction !== null ? "cursor-not-allowed opacity-45 hover:bg-[var(--lxxl-green)]" : ""}`}
              disabled={!hasType || busyAction !== null}
              title={!hasType ? "请先选择导入&导出类型" : undefined}
              onClick={handleExport}
            >
              {busyAction === "export"
                ? "导出中..."
                : activeKind === "orders"
                  ? "按日期范围导出"
                  : "下载并导出表格"}
            </QueryButton>
          </div>
        </div>

        {result && (
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ImportStat label="总行数" value={result.totalRows} />
              <ImportStat label="成功导入" value={result.importedCount} tone="green" />
              <ImportStat label="拒绝行数" value={result.rejectedCount} tone="red" />
              <ImportStat label="失败行数" value={result.failedCount} tone="red" />
            </div>
            {result.message && (
              <p className="mt-3 text-sm text-[var(--lxxl-muted)]">{result.message}</p>
            )}
          </div>
        )}
      </div>

      <ImportErrors result={result} />
      <ImportHistory items={activeKind ? history[activeKind] : []} hasType={hasType} />
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
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] p-4">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${
          tone === "green"
            ? "text-[var(--lxxl-green)]"
            : tone === "red"
              ? "text-[#A13F37]"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ImportErrors({ result }: { result: DataTransferImportResult | null }) {
  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="px-6 pt-5">
        <h3 className="text-sm font-semibold">Excel 错误详情</h3>
      </div>
      {!result ? (
        <EmptyState text="导入后会在这里显示工作表、单元格和问题。" />
      ) : result.errors.length === 0 ? (
        <EmptyState text="本次导入没有 Excel 校验错误。" />
      ) : (
        <div className="overflow-x-auto px-6 pb-5 pt-4">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#FAF8F4] text-xs text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-4 py-3">工作表</th>
                <th className="px-4 py-3">单元格</th>
                <th className="px-4 py-3">问题</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((error, index) => (
                <tr
                  key={`${error.sheet}-${error.cell}-${index}`}
                  className="border-t border-[var(--lxxl-border)] align-top"
                >
                  <td className="px-4 py-3">{error.sheet || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-[#A13F37]">
                    {error.cell || "-"}
                  </td>
                  <td className="px-4 py-3 text-[var(--lxxl-muted)]">{error.message || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ImportHistory({
  items,
  hasType,
}: {
  items: ImportHistoryItem[];
  hasType: boolean;
}) {
  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="px-6 pt-5">
        <h3 className="text-sm font-semibold">最近导入结果</h3>
        <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
          最多保留最近 {HISTORY_LIMIT} 次；记录仅保存在当前浏览器，不会同步到其他设备或账号。
        </p>
      </div>
      {!hasType ? (
        <EmptyState text="请先选择导入&导出类型后查看对应的导入记录。" />
      ) : items.length === 0 ? (
        <EmptyState text="当前浏览器暂无该类型的导入记录。" />
      ) : (
        <div className="overflow-x-auto px-6 pb-5 pt-4">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#FAF8F4] text-xs text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">文件</th>
                <th className="px-4 py-3">结果</th>
                <th className="px-4 py-3">摘要</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--lxxl-muted)]">
                    {new Date(item.importedAt).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                  <td className="max-w-64 break-all px-4 py-3">{item.fileName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={item.success ? "green" : "red"}>
                      {item.success ? "成功" : "失败/有错误"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--lxxl-muted)]">{item.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
