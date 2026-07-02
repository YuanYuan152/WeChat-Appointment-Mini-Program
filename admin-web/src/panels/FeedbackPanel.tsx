import { useState } from "react";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import { formatDateTime, statusLabel } from "@/lib/format";
import { getPageItems } from "@/lib/pagination";
import type { FeedbackItem } from "@/types/api";

import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

export function FeedbackPanel({
  feedbacks,
  listLoading,
  keyword,
  setKeyword,
  queryKeyword,
  status,
  setStatus,
  page,
  pageSize,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
}: {
  feedbacks?: FeedbackItem[];
  listLoading?: boolean;
  keyword: string;
  setKeyword: (keyword: string) => void;
  queryKeyword: string;
  status: string;
  setStatus: (status: string) => void;
  page: number;
  pageSize: number;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const items = feedbacks || [];
  const normalizedKeyword = queryKeyword.trim().toLowerCase();
  const filteredItems = normalizedKeyword
    ? items.filter((item) =>
        [
          item.userName,
          item.userMobile,
          item.category,
          item.content,
          item.contact,
          item.status,
          item.accountId ? String(item.accountId) : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword),
      )
    : items;
  const { currentPage, items: pageItems } = getPageItems(filteredItems, page, pageSize);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal">用户反馈</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">查看用户提交的反馈内容、联系方式和处理状态。</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="关键词">
            <input
              className={queryControlClass}
              placeholder="姓名/电话/内容"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </QueryField>
          <QueryField label="状态">
            <select className={queryControlClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">全部</option>
              <option value="OPEN">未处理</option>
              <option value="CLOSED">已处理</option>
            </select>
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>

      <div className="relative">
        {listLoading && items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {filteredItems.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无符合条件的用户反馈。"} />
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">提交时间</th>
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">反馈内容</th>
                  <th className="px-5 py-3 font-medium">联系方式</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                    <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{item.userName || "未留姓名用户"}</div>
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.userMobile || "-"}</div>
                    </td>
                    <td className="px-5 py-4">{item.category || "其他"}</td>
                    <td className="max-w-lg px-5 py-4 text-[var(--lxxl-muted)]">{item.content}</td>
                    <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.contact || "-"}</td>
                    <td className="px-5 py-4">
                      <Badge tone={item.status === "OPEN" ? "gold" : "green"}>{statusLabel(item.status)}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <TableActionButton onClick={() => setSelectedFeedback(item)}>
                        查看
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={filteredItems.length}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
      {selectedFeedback && (
        <DetailDrawer title="反馈详情" onClose={() => setSelectedFeedback(null)}>
          <div className="space-y-6 text-sm">
            <section className="border-b border-[var(--lxxl-border)] pb-5">
              <div className="text-xs text-[var(--lxxl-muted)]">反馈用户</div>
              <div className="mt-2 text-lg font-semibold">{selectedFeedback.userName || "未留姓名用户"}</div>
              <div className="mt-1 text-[var(--lxxl-muted)]">{selectedFeedback.userMobile || "暂无手机号"}</div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FeedbackDetailItem label="反馈类型" value={selectedFeedback.category || "其他"} />
              <FeedbackDetailItem label="处理状态" value={statusLabel(selectedFeedback.status)} />
              <FeedbackDetailItem label="提交时间" value={formatDateTime(selectedFeedback.createdAt)} />
              <FeedbackDetailItem label="联系方式" value={selectedFeedback.contact || selectedFeedback.userMobile || "-"} />
            </section>

            <section>
              <h4 className="text-base font-semibold">反馈内容</h4>
              <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#FAF8F4] px-4 py-3 leading-7 text-[var(--lxxl-ink)]">
                {selectedFeedback.content}
              </div>
            </section>
          </div>
        </DetailDrawer>
      )}
    </section>
  );
}

function FeedbackDetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}
