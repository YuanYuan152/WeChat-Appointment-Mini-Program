import { apiRequest } from "@/lib/api";
import type { CounselorRecordSummary, OpsDashboard, RefundExemption, RoomStatusSnapshot } from "@/types/api";

export async function fetchDashboardData() {
  const [dashboard, refunds, counselorRecords, roomStatus] = await Promise.all([
    apiRequest<OpsDashboard>("/api/mini/ops/dashboard"),
    apiRequest<RefundExemption[]>("/api/mini/admin/refund-exemptions?status=PENDING"),
    apiRequest<CounselorRecordSummary[]>("/api/mini/admin/consultation-records/counselors?days=30"),
    apiRequest<RoomStatusSnapshot>("/api/mini/ops/rooms/status"),
  ]);

  return { dashboard, refunds, counselorRecords, roomStatus };
}
