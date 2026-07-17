const REVIEW_QUERY_KEYS = [
  "category",
  "status",
  "exemptionId",
  "leaveId",
  "id",
  "messageId",
] as const;

export function buildReviewsResetHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  REVIEW_QUERY_KEYS.forEach((key) => nextParams.delete(key));
  const query = nextParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
