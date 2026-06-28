import type { AdminCaseRecordDetail, AdminConsultationRecord, CounselorRecordSummary } from "@/types/api";
import { formatDateTime } from "@/lib/format";

import { getPageItems } from "@/lib/pagination";
import { Badge, EmptyState, Pagination, PanelHeader, TableActionButton } from "@/components/ui";
import { DetailDrawer } from "@/components/boards/DetailDrawer";

export function CaseRecordsPanel({
  records,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedCounselorName,
  selectedRecords,
  selectedCaseRecord,
  onOpenCounselor,
  onOpenCaseRecord,
  onCloseDetails,
}: {
  records?: CounselorRecordSummary[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  selectedCounselorName?: string | null;
  selectedRecords?: AdminConsultationRecord[];
  selectedCaseRecord?: AdminCaseRecordDetail;
  onOpenCounselor: (record: CounselorRecordSummary) => void;
  onOpenCaseRecord: (recordId: number) => void;
  onCloseDetails: () => void;
}) {
  const allRecords = records || [];
  const { currentPage, items } = getPageItems(allRecords, page, pageSize);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="咨询记录" description="管理员/运营查看近 30 天咨询师记录提交情况；不允许助理查看内容。" />
      {allRecords.length === 0 ? (
        <EmptyState text="暂无咨询记录概览。" />
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
      {selectedRecords && (
        <DetailDrawer title={`${selectedCounselorName || "咨询师"}咨询记录`} onClose={onCloseDetails}>
          <div className="space-y-4">
            {selectedCaseRecord && (
              <section className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4">
                <h4 className="text-sm font-semibold">记录 #{selectedCaseRecord.Id}</h4>
                <div className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                  咨询 #{selectedCaseRecord.ConsultationId} · {selectedCaseRecord.PatientName} · 创建{" "}
                  {formatDateTime(selectedCaseRecord.CreatedAt)} · 更新 {formatDateTime(selectedCaseRecord.UpdatedAt)}
                </div>
                <RecordBlock title="主诉/主观描述" value={selectedCaseRecord.Subjective} />
                <RecordBlock title="客观记录" value={selectedCaseRecord.Objective} />
                <RecordBlock title="评估" value={selectedCaseRecord.Assessment} />
                <RecordBlock title="计划" value={selectedCaseRecord.Plan} />
                {selectedCaseRecord.PhotoUrls.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-[var(--lxxl-muted)]">附件</div>
                    <div className="mt-2 space-y-1 text-xs text-[var(--lxxl-muted)]">
                      {selectedCaseRecord.PhotoUrls.map((url) => (
                        <div key={url}>{url}</div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {selectedRecords.length === 0 ? (
              <div className="text-sm text-[var(--lxxl-muted)]">暂无近 30 天咨询记录。</div>
            ) : (
              selectedRecords.map((item) => (
                <section key={item.consultationId} className="rounded-xl border border-[var(--lxxl-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{item.patientName}</div>
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                        咨询 #{item.consultationId} · {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)}
                      </div>
                      <div className="mt-2 text-xs text-[var(--lxxl-muted)]">
                        {item.hasRecord ? `已写记录 · 更新 ${formatDateTime(item.recordUpdatedAt)}` : "未写记录"}
                      </div>
                      {item.subjectivePreview && (
                        <div className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs leading-5 text-[var(--lxxl-muted)]">
                          {item.subjectivePreview}
                        </div>
                      )}
                    </div>
                    {item.hasRecord && item.caseRecordId ? (
                      <TableActionButton onClick={() => onOpenCaseRecord(item.caseRecordId!)}>查看记录</TableActionButton>
                    ) : null}
                  </div>
                </section>
              ))
            )}
          </div>
        </DetailDrawer>
      )}
    </section>
  );
}

function RecordBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-[var(--lxxl-muted)]">{title}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{value || "-"}</div>
    </div>
  );
}
