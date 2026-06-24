import type { CounselorRecordSummary } from "@/types/api";

import { getPageItems } from "@/lib/pagination";
import { Badge, EmptyState, Pagination, PanelHeader } from "@/components/ui";

export function CaseRecordsPanel({
  records,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  records?: CounselorRecordSummary[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
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
    </section>
  );
}
