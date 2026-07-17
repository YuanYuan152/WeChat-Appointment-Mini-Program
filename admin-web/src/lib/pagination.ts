export function clampPage(page: number, total: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return Math.min(Math.max(page, 1), totalPages);
}

export function getPageItems<T>(items: T[], page: number, pageSize: number) {
  const currentPage = clampPage(page, items.length, pageSize);
  const start = (currentPage - 1) * pageSize;
  return {
    currentPage,
    items: items.slice(start, start + pageSize),
  };
}
