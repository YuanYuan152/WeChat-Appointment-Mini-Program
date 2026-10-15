import { useState } from "react";

import type {
  AdminCaseRecordDetail,
  AdminConsultationRecord,
  CounselorRecordSummary,
} from "@/types/api";
import {
  RISK_ASSESSMENT_ITEMS,
  formatRiskChoiceDisplay,
  normalizeRiskAssessment,
  normalizeRiskChoice,
  type RiskAssessmentData,
} from "@/constants/caseRecordRiskAssessment";
import { API_BASE_URL } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import { downloadCaseRecordPdf, formatCaseRecordHeaderInfo } from "@/lib/download-case-record-pdf";

import { getPageItems } from "@/lib/pagination";
import { CaseRecordsViewSwitch } from "@/components/CaseRecordsViewSwitch";
import { Badge, EmptyState, Pagination, PanelHeader, TableActionButton } from "@/components/ui";
import { QueryButton, QueryField, QueryResetButton, queryControlClass } from "@/components/ui";
import { DetailDrawer } from "@/components/boards/DetailDrawer";
import type { CaseRecordPeriod } from "@/services/records";

const PERIOD_OPTIONS: Array<{ value: CaseRecordPeriod; label: string }> = [
  { value: "all", label: "全部时间" },
  { value: "month", label: "本月" },
  { value: "week", label: "一周内" },
  { value: "today", label: "当天" },
];

function periodLabel(period: CaseRecordPeriod) {
  return PERIOD_OPTIONS.find((item) => item.value === period)?.label || "本月";
}

export function CaseRecordsPanel({
  records,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  period,
  setPeriod,
  counselorKeyword,
  setCounselorKeyword,
  appliedPeriod,
  onApplyRecordFilters,
  onResetRecordFilters,
  selectedCounselorName,
  selectedRecords,
  selectedRecordsLoading,
  selectedCaseRecord,
  caseRecordLoading,
  recordsLoading,
  onOpenCounselor,
  onOpenCaseRecord,
  onBackToRecordList,
  onCloseDetails,
}: {
  records?: CounselorRecordSummary[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  period: CaseRecordPeriod;
  setPeriod: (value: CaseRecordPeriod) => void;
  counselorKeyword: string;
  setCounselorKeyword: (value: string) => void;
  appliedPeriod: CaseRecordPeriod;
  onApplyRecordFilters: () => void;
  onResetRecordFilters: () => void;
  selectedCounselorName?: string | null;
  selectedRecords?: AdminConsultationRecord[];
  selectedRecordsLoading?: boolean;
  selectedCaseRecord?: AdminCaseRecordDetail;
  caseRecordLoading?: boolean;
  recordsLoading?: boolean;
  onOpenCounselor: (record: CounselorRecordSummary) => void;
  onOpenCaseRecord: (recordId: number) => void;
  onBackToRecordList: () => void;
  onCloseDetails: () => void;
}) {
  const allRecords = records || [];
  const { currentPage, items } = getPageItems(allRecords, page, pageSize);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="咨询记录"
        description={`管理员、咨询主任、咨询助理可查看咨询师记录提交情况（当前：${periodLabel(appliedPeriod)}）。`}
        action={<CaseRecordsViewSwitch active="records" />}
      />
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <QueryField label="时间范围" className="w-full sm:w-44">
            <select
              className={queryControlClass}
              value={period}
              onChange={(event) => setPeriod(event.target.value as CaseRecordPeriod)}
            >
              {PERIOD_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </QueryField>
          <QueryField label="咨询师姓名" className="w-full sm:w-56">
            <input
              className={queryControlClass}
              placeholder="输入咨询师姓名"
              value={counselorKeyword}
              onChange={(event) => setCounselorKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onApplyRecordFilters();
              }}
            />
          </QueryField>
          <QueryButton onClick={onApplyRecordFilters}>查询</QueryButton>
          <QueryResetButton onClick={onResetRecordFilters}>重置</QueryResetButton>
        </div>
      </div>
      <div className="relative">
        {recordsLoading && allRecords.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在刷新记录概览...
          </div>
        )}
        {allRecords.length === 0 ? (
          <EmptyState text={recordsLoading ? "正在加载咨询记录概览..." : "暂无咨询记录概览。"} />
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">咨询师</th>
                <th className="px-5 py-3 font-medium">完成咨询</th>
                <th className="px-5 py-3 font-medium">已写记录</th>
                <th className="px-5 py-3 font-medium">缺失记录</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((record) => (
                <tr key={record.counselorId} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4">{record.counselorName}</td>
                  <td className="px-5 py-4">{record.completedCount}</td>
                  <td className="px-5 py-4">{record.recordedCount}</td>
                  <td className="px-5 py-4">
                    <Badge tone={record.missingCount > 0 ? "gold" : "green"}>{record.missingCount}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <TableActionButton onClick={() => onOpenCounselor(record)}>查看</TableActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={allRecords.length}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
      {selectedCounselorName && (
        <DetailDrawer title={`${selectedCounselorName || "咨询师"}咨询记录`} onClose={onCloseDetails}>
          {selectedCaseRecord ? (
            <CaseRecordDetailView record={selectedCaseRecord} onBack={onBackToRecordList} />
          ) : (
            <CounselorRecordListView
              loading={selectedRecordsLoading}
              openingRecord={caseRecordLoading}
              period={appliedPeriod}
              records={selectedRecords || []}
              onOpenCaseRecord={onOpenCaseRecord}
            />
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function CounselorRecordListView({
  records,
  loading,
  openingRecord,
  period,
  onOpenCaseRecord,
}: {
  records: AdminConsultationRecord[];
  loading?: boolean;
  openingRecord?: boolean;
  period: CaseRecordPeriod;
  onOpenCaseRecord: (recordId: number) => void;
}) {
  const rangeText = periodLabel(period);
  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--lxxl-border)] pb-4">
        <h4 className="text-base font-semibold">
          {rangeText}咨询记录 <span className="ml-2 text-sm font-normal text-[var(--lxxl-muted)]">{records.length} 条</span>
        </h4>
        <p className="mt-2 text-xs text-[var(--lxxl-muted)]">点击单条记录可查看咨询师已填写的完整咨询记录。</p>
      </div>
      {loading ? <div className="py-8 text-sm text-[var(--lxxl-muted)]">正在加载咨询记录...</div> : null}
      {openingRecord ? (
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">正在打开咨询记录...</div>
      ) : null}
      {!loading && records.length === 0 ? (
        <div className="py-8 text-sm text-[var(--lxxl-muted)]">暂无{rangeText}咨询记录。</div>
      ) : (
        <div className="space-y-3">
          {records.map((item) => (
            <section key={item.consultationId} className="rounded-xl bg-[#FAF8F4] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {formatPatientNameWithContractTag(item.patientName, item.patientContractTag)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                    {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)}
                  </div>
                  <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
                    {item.hasRecord ? `已写记录 · 更新 ${formatDateTime(item.recordUpdatedAt)}` : "未写记录"}
                  </div>
                  {item.subjectivePreview && (
                    <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                      {item.subjectivePreview}
                    </div>
                  )}
                </div>
                {item.hasRecord && item.caseRecordId ? (
                  <TableActionButton disabled={openingRecord} onClick={() => onOpenCaseRecord(item.caseRecordId!)}>
                    查看记录
                  </TableActionButton>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseRecordDetailView({ record, onBack }: { record: AdminCaseRecordDetail; onBack: () => void }) {
  const riskAssessment = record.RiskAssessment ? normalizeRiskAssessment(record.RiskAssessment) : null;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--lxxl-border)] pb-4">
        <div className="min-w-0">
          <h4 className="text-base font-semibold">咨询记录详情</h4>
          <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
            {formatPatientNameWithContractTag(record.PatientName, record.PatientContractTag)} · {formatDateTime(record.StartTime)} 至 {formatDateTime(record.EndTime)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
            创建 {formatDateTime(record.CreatedAt)} · 更新 {formatDateTime(record.UpdatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {downloadError && <span className="text-xs text-[#B42318]">{downloadError}</span>}
          <QueryButton
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              setDownloadError("");
              try {
                await downloadCaseRecordPdf(record);
              } catch (error) {
                setDownloadError(error instanceof Error ? error.message : "PDF 生成失败");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <DownloadIcon />
            {downloading ? "生成 PDF 中..." : "下载咨询记录 PDF"}
          </QueryButton>
          <TableActionButton onClick={onBack}>返回记录列表</TableActionButton>
        </div>
      </div>
      <RecordBlock title="表头信息" value={formatCaseRecordHeaderInfo(record.HeaderInfo)} />
      <RecordBlock title="患者情况记录（主观陈述）" value={record.Subjective} />
      <RecordBlock title="客观观察" value={record.Objective} />
      <RecordBlock title="评估分析" value={record.Assessment} />
      <RecordBlock title="计划方向" value={record.Plan} />
      <RiskAssessmentBlock value={riskAssessment} />
      {record.PhotoUrls.length > 0 && <RecordPhotos urls={record.PhotoUrls} />}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function RecordBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <section className="border-t border-[var(--lxxl-border)] pt-4">
      <h5 className="text-sm font-semibold">{title}</h5>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--lxxl-muted)]">{value || "-"}</div>
    </section>
  );
}

function RiskAssessmentBlock({ value }: { value: RiskAssessmentData | null }) {
  if (!value) {
    return <RecordBlock title="风险/危机评估" value="暂无风险评估" />;
  }

  return (
    <section className="border-t border-[var(--lxxl-border)] pt-4">
      <h5 className="text-sm font-semibold">风险/危机评估</h5>
      <div className="mt-3 space-y-2">
        {RISK_ASSESSMENT_ITEMS.map((item) => {
          const entry = value.items[item.id];
          const choice = normalizeRiskChoice(entry?.choice || "", item.id);
          const note = entry?.note || "";
          return (
            <div key={item.id} className="rounded-xl bg-[#FAF8F4] px-3 py-2 text-sm leading-6">
              <div className="font-medium text-[var(--lxxl-text)]">
                {item.index}. {item.label}
              </div>
              <div className="mt-1 text-[var(--lxxl-muted)]">{formatRiskChoiceDisplay(item.id, choice, note)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecordPhotos({ urls }: { urls: string[] }) {
  return (
    <section className="border-t border-[var(--lxxl-border)] pt-4">
      <h5 className="text-sm font-semibold">相关照片</h5>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {urls.filter(Boolean).map((url, index) => {
          const src = normalizePhotoUrl(url);
          return (
            <a
              key={`${url}-${index}`}
              className="group block aspect-square overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4]"
              href={src}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={`咨询记录照片 ${index + 1}`}
                className="h-full w-full object-cover transition group-hover:scale-105"
                src={src}
              />
            </a>
          );
        })}
      </div>
    </section>
  );
}

function normalizePhotoUrl(url: string) {
  const value = url.trim();
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
