import { apiRequest } from "@/lib/api";
import type { CounselorRecordSummary, MessageItem, OpsDashboard, RefundExemption, RoomStatusSnapshot } from "@/types/api";

export async function fetchDashboardData() {
  const [dashboard, refunds, counselorRecords, roomStatus, messages] = await Promise.all([
    apiRequest<OpsDashboard>("/api/mini/ops/dashboard"),
    apiRequest<RefundExemption[]>("/api/mini/admin/refund-exemptions?status=PENDING"),
    apiRequest<CounselorRecordSummary[]>("/api/mini/admin/consultation-records/counselors?days=30"),
    apiRequest<RoomStatusSnapshot>("/api/mini/ops/rooms/status"),
    apiRequest<MessageItem[]>("/api/mini/message/list?unread_only=true"),
  ]);

  return { dashboard, refunds, counselorRecords, roomStatus, messages };
}
