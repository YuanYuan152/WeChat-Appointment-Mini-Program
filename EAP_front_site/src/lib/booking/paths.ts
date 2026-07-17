/** 咨询师详情页 URL（使用 query，避免 /consultation/[id] 动态路由在部分环境下 404） */
export function consultationDetailPath(
  counselorId: number,
  source?: string | null
): string {
  const params = new URLSearchParams({ id: String(counselorId) });
  if (source) {
    params.set("source", source);
  }
  return `/consultation?${params.toString()}`;
}
