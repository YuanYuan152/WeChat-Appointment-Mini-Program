import { useState } from "react";

import type {
  AdminCaseRecordDetail,
  AdminConsultationRecord,
  CaseRecordAmendment,
  CounselorRecordSummary,
} from "@/types/api";
import { formatDateTime } from "@/lib/format";

import { getPageItems } from "@/lib/pagination";
import { Badge, CollapsibleSection, EmptyState, Pagination, PanelHeader, TableActionButton } from "@/components/ui";
import { QueryButton, QueryField, QueryResetButton, queryControlClass } from "@/components/ui";
import { DetailDrawer } from "@/components/boards/DetailDrawer";

export function CaseRecordsPanel({
  records,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedCounselorName,
  selectedRecords,
  selectedRecordsLoading,
  selectedCaseRecord,
  caseRecordLoading,
  amendments,
  amendmentStatus,
  setAmendmentStatus,
  onLoadAmendments,
  onApproveAmendment,
  onRejectAmendment,
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
  selectedCounselorName?: string | null;
  selectedRecords?: AdminConsultationRecord[];
  selectedRecordsLoading?: boolean;
  selectedCaseRecord?: AdminCaseRecordDetail;
  caseRecordLoading?: boolean;
  amendments?: CaseRecordAmendment[];
  amendmentStatus: string;
  setAmendmentStatus: (value: string) => void;
  onLoadAmendments: () => void;
  onApproveAmendment: (amendmentId: number) => void;
  onRejectAmendment: (amendmentId: number, rejectReason: string) => void;
  onOpenCounselor: (record: CounselorRecordSummary) => void;
  onOpenCaseRecord: (recordId: number) => void;
  onBackToRecordList: () => void;
  onCloseDetails: () => void;
}) {
  const allRecords = records || [];
  const { currentPage, items } = getPageItems(allRecords, page, pageSize);
  const [selectedAmendment, setSelectedAmendment] = useState<CaseRecordAmendment | null>(null);
  const [rejectingAmendment, setRejectingAmendment] = useState<CaseRecordAmendment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="咨询记录" description="管理员/运营查看近 30 天咨询师记录提交情况；不允许助理查看内容。" />
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <QueryField label="修改审核状态" className="w-full sm:w-56">
            <select
              className={queryControlClass}
              value={amendmentStatus}
              onChange={(event) => setAmendmentStatus(event.target.value)}
            >
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已拒绝</option>
              <option value="ALL">全部</option>
            </select>
          </QueryField>
          <QueryButton onClick={onLoadAmendments}>查询</QueryButton>
        </div>
        <div className="mt-5">
          <h3 className="text-base font-semibold">咨询记录修改审核</h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            咨询师提交修改申请后，管理员可查看变更内容并通过或驳回。
          </p>
        </div>
        {!amendments || amendments.length === 0 ? (
          <div className="py-8 text-sm text-[var(--lxxl-muted)]">暂无修改申请。</div>
        ) : (
          <table className="mt-4 w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">提交时间</th>
                <th className="px-5 py-3 font-medium">咨询师</th>
                <th className="px-5 py-3 font-medium">咨询/记录</th>
                <th className="px-5 py-3 font-medium">原因</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {amendments.map((item) => (
                <tr key={item.id} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-4 font-medium">{item.counselorName}</td>
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                    咨询 #{item.consultationId} · 记录 #{item.caseRecordId}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-[var(--lxxl-muted)]">{item.reason || "-"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.status === "REJECTED" ? "red" : item.status === "APPROVED" ? "green" : "gold"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-3">
                      <TableActionButton onClick={() => setSelectedAmendment(item)}>查看</TableActionButton>
                      {item.status === "PENDING" && (
                        <>
                          <TableActionButton onClick={() => onApproveAmendment(item.id)}>通过</TableActionButton>
                          <TableActionButton
                            tone="danger"
                            onClick={() => {
                              setRejectingAmendment(item);
                              setRejectReason("");
                            }}
                          >
                            驳回
                          </TableActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
      {selectedCounselorName && (
        <DetailDrawer title={`${selectedCounselorName || "咨询师"}咨询记录`} onClose={onCloseDetails}>
          {selectedCaseRecord ? (
            <CaseRecordDetailView record={selectedCaseRecord} onBack={onBackToRecordList} />
          ) : (
            <CounselorRecordListView
              loading={selectedRecordsLoading}
              openingRecord={caseRecordLoading}
              records={selectedRecords || []}
              onOpenCaseRecord={onOpenCaseRecord}
            />
          )}
        </DetailDrawer>
      )}
      {selectedAmendment && (
        <DetailDrawer title={`修改申请 #${selectedAmendment.id}`} onClose={() => setSelectedAmendment(null)}>
          <div className="text-sm text-[var(--lxxl-muted)]">
            {selectedAmendment.counselorName} · 咨询 #{selectedAmendment.consultationId} · 记录 #
            {selectedAmendment.caseRecordId}
          </div>
          <RecordCompareBlock
            title="患者情况记录（主观陈述）"
            current={selectedAmendment.current.subjective}
            proposed={selectedAmendment.proposed.subjective}
          />
          <RecordCompareBlock title="客观观察" current={selectedAmendment.current.objective} proposed={selectedAmendment.proposed.objective} />
          <RecordCompareBlock title="评估分析" current={selectedAmendment.current.assessment} proposed={selectedAmendment.proposed.assessment} />
          <RecordCompareBlock title="计划方向" current={selectedAmendment.current.plan} proposed={selectedAmendment.proposed.plan} />
          <div className="mt-6 text-sm">
            <div className="font-semibold">修改原因</div>
            <div className="mt-2 whitespace-pre-wrap text-[var(--lxxl-muted)]">{selectedAmendment.reason || "-"}</div>
          </div>
        </DetailDrawer>
      )}
      {rejectingAmendment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6">
          <section className="w-full max-w-lg rounded-xl border border-[var(--lxxl-border)] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">驳回修改申请</h3>
            <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
              {rejectingAmendment.counselorName} · 记录 #{rejectingAmendment.caseRecordId}
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">驳回原因</span>
              <textarea
                className={`${queryControlClass} h-28 resize-none py-3`}
                placeholder="请输入驳回原因"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <QueryResetButton
                onClick={() => {
                  setRejectingAmendment(null);
                  setRejectReason("");
                }}
              >
                关闭
              </QueryResetButton>
              <QueryButton
                disabled={!rejectReason.trim()}
                onClick={() => {
                  onRejectAmendment(rejectingAmendment.id, rejectReason);
                  setRejectingAmendment(null);
                  setRejectReason("");
                }}
              >
                确认
              </QueryButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CounselorRecordListView({
  records,
  loading,
  openingRecord,
  onOpenCaseRecord,
}: {
  records: AdminConsultationRecord[];
  loading?: boolean;
  openingRecord?: boolean;
  onOpenCaseRecord: (recordId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--lxxl-border)] pb-4">
        <h4 className="text-base font-semibold">
          近 30 天咨询记录 <span className="ml-2 text-sm font-normal text-[var(--lxxl-muted)]">{records.length} 条</span>
        </h4>
        <p className="mt-2 text-xs text-[var(--lxxl-muted)]">点击单条记录可查看咨询师已填写的完整咨询记录。</p>
      </div>
      {loading ? <div className="py-8 text-sm text-[var(--lxxl-muted)]">正在加载咨询记录...</div> : null}
      {openingRecord ? (
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm text-[var(--lxxl-muted)]">正在打开咨询记录...</div>
      ) : null}
      {!loading && records.length === 0 ? (
        <div className="py-8 text-sm text-[var(--lxxl-muted)]">暂无近 30 天咨询记录。</div>
      ) : (
        <div className="space-y-3">
          {records.map((item) => (
            <section key={item.consultationId} className="rounded-xl bg-[#FAF8F4] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.patientName}</div>
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
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--lxxl-border)] pb-4">
        <div className="min-w-0">
          <h4 className="text-base font-semibold">咨询记录详情</h4>
          <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
            {record.PatientName} · {formatDateTime(record.StartTime)} 至 {formatDateTime(record.EndTime)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
            创建 {formatDateTime(record.CreatedAt)} · 更新 {formatDateTime(record.UpdatedAt)}
          </p>
        </div>
        <TableActionButton onClick={onBack}>返回记录列表</TableActionButton>
      </div>
      <RecordBlock title="患者情况记录（主观陈述）" value={record.Subjective} />
      <RecordBlock title="客观观察" value={record.Objective} />
      <RecordBlock title="评估分析" value={record.Assessment} />
      <RecordBlock title="计划方向" value={record.Plan} />
      {record.PhotoUrls.length > 0 && <RecordBlock title="相关照片" value={record.PhotoUrls.join("\n")} />}
    </div>
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

function RecordCompareBlock({
  title,
  current,
  proposed,
}: {
  title: string;
  current?: string | null;
  proposed?: string | null;
}) {
  return (
    <CollapsibleSection title={title}>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="rounded-xl bg-[#FAF8F4] p-3">
          <div className="text-xs font-medium text-[var(--lxxl-muted)]">当前内容</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{current || "-"}</div>
        </div>
        <div className="rounded-xl border border-[var(--lxxl-border)] p-3">
          <div className="text-xs font-medium text-[var(--lxxl-muted)]">申请修改为</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{proposed || "-"}</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
