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
    label: "来访数据",
    description: "批量维护来访者基础资料。",
    rules: [
      "请先下载最新模板，保持工作表名称和表头不变。",
      "每行填写一位来访者；必填项、格式和可选值以模板中的说明为准。",
      "系统会先校验整张表；只要存在任一错误，本次整表零写入。请根据下方工作表、单元格和问题修正后重试。",
    ],
    filename: "来访数据",
  },
  counselors: {
    label: "咨询师数据",
    description: "批量维护咨询师账号及资料。",
    rules: [
      "请使用本页下载的最新模板，不要删除或重命名工作表及表头。",
      "每行填写一位咨询师；必填项、格式和可选值以模板中的说明为准。",
      "系统会先校验整张表；只要存在任一错误，本次整表零写入。请根据下方工作表、单元格和问题修正后重试。",
    ],
    filename: "咨询师数据",
  },
  orders: {
    label: "订单数据",
    description: "批量维护预约及订单数据。",
    rules: [
      "请使用最新订单模板，并保持工作表名称、表头和日期时间格式不变。",
      "导入前请确认来访者、咨询师及预约时间等关联信息准确，具体约束以模板说明为准。",
      "系统会先校验整张表；只要存在任一错误，本次整表零写入。订单导出必须选择预约开始日期范围。",
    ],
    filename: "订单数据",
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
  const [activeKind, setActiveKind] = useState<DataTransferKind>("visitors");
  const [files, setFiles] = useState<KindFiles>(emptyFiles);
  const [results, setResults] = useState<KindResults>(emptyResults);
  const [history, setHistory] = useState<KindHistory>(emptyHistory);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busyAction, setBusyAction] = useState<"template" | "import" | "export" | null>(null);

  const config = KIND_CONFIG[activeKind];
  const file = files[activeKind];
  const result = results[activeKind];

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
      showNotice("error", "请先选择 .xlsx 文件");
      return;
    }
    saveFile(file, file.name);
  };

  const handleImport = async () => {
    if (!file) {
      showNotice("error", "请先选择需要导入的 .xlsx 文件");
      return;
    }
    try {
      await runBusy("import", async () => {
        const response = await importDataTransfer(activeKind, file);
        setResults((current) => ({ ...current, [activeKind]: response }));
        const failedCount = response.errors.length;
        const summary = `共 ${response.totalRows} 行，成功 ${response.importedCount} 行，错误 ${failedCount} 项`;
        addHistory(activeKind, {
          fileName: file.name,
          success: failedCount === 0,
          summary,
        });
        showNotice(failedCount > 0 ? "info" : "success", response.message || "导入完成");
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      addHistory(activeKind, { fileName: file.name, success: false, summary: message });
      showNotice("error", message);
    }
  };

  const handleExport = async () => {
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

  const handleReset = () => {
    setFiles((current) => ({ ...current, [activeKind]: null }));
    setResults((current) => ({ ...current, [activeKind]: null }));
    if (inputRef.current) inputRef.current.value = "";
    clearNotice();
  };

  const changeTab = (kind: DataTransferKind) => {
    setActiveKind(kind);
    clearNotice();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="数据导入导出"
        description="下载标准模板、导入 Excel，或按数据类型导出备份。"
      />

      <div className="flex overflow-x-auto border-b border-[var(--lxxl-border)] px-6" role="tablist">
        {KINDS.map((kind) => (
          <button
            key={kind}
            aria-selected={activeKind === kind}
            className={`shrink-0 border-b-2 px-5 py-4 text-sm font-medium transition ${
              activeKind === kind
                ? "border-[var(--lxxl-green)] text-[var(--lxxl-green)]"
                : "border-transparent text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]"
            }`}
            role="tab"
            type="button"
            onClick={() => changeTab(kind)}
          >
            {KIND_CONFIG[kind].label}
          </button>
        ))}
      </div>

      <div className="space-y-6 px-6 py-5" role="tabpanel">
        <div>
          <h3 className="text-sm font-semibold">{config.label}导入规则</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">{config.description}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--lxxl-muted)]">
            {config.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
          <QueryResetButton className="mt-4 w-auto" disabled={busyAction !== null} onClick={handleTemplateDownload}>
            {busyAction === "template" ? "下载中..." : "下载 Excel 模板"}
          </QueryResetButton>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl bg-[#FAF8F4] p-4">
            <h3 className="text-sm font-semibold">正式导入</h3>
            <label className="mt-4 block text-xs font-medium text-[var(--lxxl-muted)]">
              Excel 文件 <span className="ml-1 text-[#B34B43]">*</span>
            </label>
            <input
              key={activeKind}
              ref={inputRef}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-2 block w-full cursor-pointer rounded-xl border border-[var(--lxxl-border)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--lxxl-green)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              type="file"
              onChange={(event) => {
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
            <p className="mt-3 break-all text-xs leading-5 text-[var(--lxxl-muted)]">
              {file ? `已选择：${file.name}（${formatFileSize(file.size)}）` : "仅支持 .xlsx 文件。"}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <QueryButton disabled={!file || busyAction !== null} onClick={handleImport}>
                {busyAction === "import" ? "导入中..." : "正式导入"}
              </QueryButton>
              <QueryResetButton disabled={!file || busyAction !== null} onClick={handleSelectedFileDownload}>
                重新下载
              </QueryResetButton>
              <QueryResetButton disabled={busyAction !== null} onClick={handleReset}>重置</QueryResetButton>
            </div>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] p-4">
            <h3 className="text-sm font-semibold">数据导出</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
              {activeKind === "orders"
                ? "按预约开始日期范围导出订单数据，开始和结束日期均包含在范围内。"
                : `导出当前系统中的全部${config.label}。`}
            </p>
            {activeKind === "orders" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <QueryField label="预约开始日期（起）" required>
                  <input className={queryControlClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </QueryField>
                <QueryField label="预约开始日期（止）" required>
                  <input className={queryControlClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </QueryField>
              </div>
            )}
            <QueryButton className="mt-4 w-auto" disabled={busyAction !== null} onClick={handleExport}>
              {busyAction === "export" ? "导出中..." : activeKind === "orders" ? "按日期范围导出" : "导出全部"}
            </QueryButton>
          </div>
        </div>

        {result && (
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ImportStat label="总行数" value={result.totalRows} />
              <ImportStat label="成功导入" value={result.importedCount} tone="green" />
              <ImportStat label="错误项" value={result.errors.length} tone="red" />
            </div>
            <p className="mt-3 text-sm text-[var(--lxxl-muted)]">{result.message}</p>
          </div>
        )}
      </div>

      <ImportErrors result={result} />
      <ImportHistory items={history[activeKind]} />
    </section>
  );
}

function ImportStat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] p-4">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "green" ? "text-[var(--lxxl-green)]" : tone === "red" ? "text-[#A13F37]" : ""}`}>
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
              <tr><th className="px-4 py-3">工作表</th><th className="px-4 py-3">单元格</th><th className="px-4 py-3">问题</th></tr>
            </thead>
            <tbody>
              {result.errors.map((error, index) => (
                <tr key={`${error.sheet}-${error.cell}-${index}`} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="px-4 py-3">{error.sheet || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-[#A13F37]">{error.cell || "-"}</td>
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

function ImportHistory({ items }: { items: ImportHistoryItem[] }) {
  return (
    <div className="border-t border-[var(--lxxl-border)]">
      <div className="px-6 pt-5">
        <h3 className="text-sm font-semibold">最近导入结果</h3>
        <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
          最多保留最近 {HISTORY_LIMIT} 次；记录仅保存在当前浏览器，不会同步到其他设备或账号。
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState text="当前浏览器暂无该类型的导入记录。" />
      ) : (
        <div className="overflow-x-auto px-6 pb-5 pt-4">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#FAF8F4] text-xs text-[var(--lxxl-muted)]">
              <tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">文件</th><th className="px-4 py-3">结果</th><th className="px-4 py-3">摘要</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--lxxl-muted)]">{new Date(item.importedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                  <td className="max-w-64 break-all px-4 py-3">{item.fileName}</td>
                  <td className="px-4 py-3"><Badge tone={item.success ? "green" : "red"}>{item.success ? "成功" : "失败/有错误"}</Badge></td>
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
