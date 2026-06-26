import type {
  Activity,
  AdminUser,
  Article,
  Banner,
  CounselorBoardDetail,
  CounselorBoardSummary,
  FeedbackItem,
  MessageItem,
  CounselorRecordSummary,
  AdminCaseRecordDetail,
  AdminConsultationRecord,
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
  | "messages"
  | "roles"
  | "refunds"
  | "feedback"
  | "content"
  | "schedules"
  | "rooms"
  | "caseRecords"
  | "operationLogs"
  | "userBoard"
  | "counselorBoard";

export interface NavigationSection {
  id: SectionId;
  label: string;
  desc: string;
  path: string;
  adminOnly?: boolean;
}

export interface NavigationGroup {
  id: string;
  label: string;
  sectionIds: SectionId[];
}

export interface ScreenData {
  dashboard?: OpsDashboard;
  messages?: MessageItem[];
  refunds?: RefundExemption[];
  feedbacks?: FeedbackItem[];
  adminUsers?: AdminUser[];
  banners?: Banner[];
  activities?: Activity[];
  articles?: PagedResult<Article>;
  schedules?: ScheduleOverview;
  rooms?: Room[];
  roomStatus?: RoomStatusSnapshot;
  counselorRecords?: CounselorRecordSummary[];
  selectedCounselorRecords?: AdminConsultationRecord[];
  selectedCaseRecord?: AdminCaseRecordDetail;
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
  operatorId: string;
  startAt: string;
  endAt: string;
}

export interface UserBoardFilters {
  keyword: string;
  gender: string;
  mobile: string;
}

export interface RoomFilters {
  centerId: string;
  date: string;
  timeSlot: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export type ContentKind = "banner" | "activity" | "article";

export interface ContentDraft {
  kind: ContentKind;
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
