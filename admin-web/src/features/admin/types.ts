import type {
  Activity,
  AdminUser,
  Article,
  Banner,
  CounselorBoardDetail,
  CounselorBoardSummary,
  CounselorRecordSummary,
  OperationRecord,
  OpsDashboard,
  PagedResult,
  RefundExemption,
  Room,
  RoomStatusSnapshot,
  ScheduleOverview,
  UserBoardDetail,
  UserBoardSummary,
} from "@/types/api";

export type SectionId =
  | "dashboard"
  | "roles"
  | "refunds"
  | "content"
  | "schedules"
  | "rooms"
  | "caseRecords"
  | "operationLogs"
  | "userBoard"
  | "counselorBoard";

export interface AdminSection {
  id: SectionId;
  label: string;
  desc: string;
  adminOnly?: boolean;
}

export interface AdminData {
  dashboard?: OpsDashboard;
  refunds?: RefundExemption[];
  adminUsers?: AdminUser[];
  banners?: Banner[];
  activities?: Activity[];
  articles?: PagedResult<Article>;
  schedules?: ScheduleOverview;
  rooms?: Room[];
  roomStatus?: RoomStatusSnapshot;
  counselorRecords?: CounselorRecordSummary[];
  operationRecords?: PagedResult<OperationRecord>;
  userBoard?: PagedResult<UserBoardSummary>;
  selectedUserBoard?: UserBoardDetail;
  counselorBoard?: PagedResult<CounselorBoardSummary>;
  selectedCounselorBoard?: CounselorBoardDetail;
}

export interface Notice {
  type: "info" | "error" | "success";
  text: string;
}

export interface OperationFilters {
  keyword: string;
  role: string;
  actionType: string;
}

export interface ContentDraft {
  kind: string;
  title: string;
  summary: string;
  imageUrl: string;
}

export interface SummaryRow {
  time: string;
  type: string;
  subject: string;
  status: string;
  amount: string;
}
