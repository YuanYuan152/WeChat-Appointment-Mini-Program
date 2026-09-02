import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { API_BASE_URL } from "@/lib/api";

import { EmptyState, Pagination, PanelHeader, TableActionButton } from "@/components/ui";

export interface ContentListItem {
  id: number;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  date?: string | null;
  summary?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  assistantQrcodeUrl?: string | null;
  coverImageUrl?: string | null;
  coverCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  pageKey?: string;
}

export function ContentList({
  title,
  items,
  total,
  page,
  pageSize,
  createLabel = "新增",
  headerAction,
  allowDelete = true,
  hideImageColumn = false,
  onCreateClick,
  onEdit,
  onDelete,
  onPageChange,
  onPageSizeChange,
}: {
  title: string;
  items: ContentListItem[];
  total: number;
  page?: number;
  pageSize?: number;
  createLabel?: string;
  headerAction?: ReactNode;
  allowDelete?: boolean;
  hideImageColumn?: boolean;
  onCreateClick?: () => void;
  onEdit: (item: ContentListItem) => void;
  onDelete: (id: number) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  return (
    <>
      <PanelHeader
        title={title}
        description={`共 ${total} 条内容。`}
        action={
          headerAction ?? (
            onCreateClick ? (
              <button
                className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]"
                type="button"
                onClick={onCreateClick}
              >
                {createLabel}
              </button>
            ) : null
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState text="暂无内容。" />
      ) : (
        <div className="overflow-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className={hideImageColumn ? "w-[28%]" : "w-[24%]"} />
              <col className="w-[11%]" />
              <col className={hideImageColumn ? "w-[33%]" : "w-[21%]"} />
              {!hideImageColumn && <col className="w-[14%]" />}
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="px-5 py-3 font-medium">状态/类型</th>
                <th className="px-5 py-3 font-medium">摘要</th>
                {!hideImageColumn && <th className="px-5 py-3 font-medium">图片</th>}
                <th className="px-5 py-3 font-medium">更新时间</th>
                <th className="px-6 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[var(--lxxl-border)] align-top transition hover:bg-[#FAF8F4]"
                >
                  <td className="min-w-0 px-5 py-4 font-medium">
                    <div className="line-clamp-2 break-words" title={item.title}>
                      {item.title}
                    </div>
                  </td>
                  <td className="break-words px-5 py-4 text-[var(--lxxl-muted)]">{item.meta || "-"}</td>
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                    <div className="line-clamp-2">{item.summary || "-"}</div>
                  </td>
                  {!hideImageColumn && (
                    <td className="px-5 py-4">
                      <ContentImageThumbnail imageUrl={item.imageUrl} title={item.title} />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">{formatDate(item.date)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex justify-end gap-4 whitespace-nowrap">
                      <TableActionButton onClick={() => onEdit(item)}>修改</TableActionButton>
                      {allowDelete ? (
                        <TableActionButton tone="danger" onClick={() => onDelete(item.id)}>
                          删除
                        </TableActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onPageChange && total != null && page != null && pageSize != null && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}

function ContentImageThumbnail({
  imageUrl,
  title,
}: {
  imageUrl?: string | null;
  title: string;
}) {
  const resolvedImageUrl = resolveImageUrl(imageUrl);

  if (!resolvedImageUrl) {
    return <span className="text-sm text-[var(--lxxl-muted)]">-</span>;
  }

  return (
    <div
      aria-label={`${title}图片缩略图`}
      className="h-12 w-20 rounded-lg border border-[var(--lxxl-border)] bg-[#FAF8F4] bg-cover bg-center"
      role="img"
      style={{ backgroundImage: `url("${resolvedImageUrl.replace(/"/g, '\\"')}")` }}
      title={imageUrl || undefined}
    />
  );
}

function resolveImageUrl(imageUrl?: string | null) {
  const value = imageUrl?.trim();
  if (!value) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  return value.startsWith("/") ? `${API_BASE_URL}${value}` : `${API_BASE_URL}/${value}`;
}
