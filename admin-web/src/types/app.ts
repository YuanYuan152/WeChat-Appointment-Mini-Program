import type {
  Activity,
  AdminUser,
  Article,
  Banner,
  CaseRecordAmendment,
  CounselorBoardDetail,
  CounselorBoardSummary,
  CounselorCaseRecord,
  CounselorCompletedConsultation,
  CounselorDashboardDetailItem,
  CounselorDashboardStats,
  CounselorScheduleCalendar,
  CounselorSlotOptions,
  CompletedOrderImportResult,
  FeedbackItem,
  MessageItem,
  ProxyScheduleCalendar,
  ProxySlotOptions,
  CounselorRecordSummary,
  AdminCaseRecordDetail,
  AdminConsultationRecord,
  OperationRecord,
  OpsDashboard,
  PagedResult,
  RefundExemption,
  Room,
  RoomDetail,
  RoomStatusSnapshot,
  Role,
  ScheduleRoomOptions,
  ScheduleOverview,
  UserBoardDetail,
  UserBoardSummary,
} from "@/types/api";

export type SectionId =
  | "dashboard"
  | "messages"
  | "myProfile"
  | "roles"
  | "refunds"
  | "feedback"
  | "content"
  | "assessments"
  | "assessmentReports"
  | "schedules"
  | "rooms"
  | "pricing"
  | "proxyBooking"
  | "caseRecords"
  | "operationLogs"
  | "dataImport"
  | "userBoard"
  | "counselorBoard"
  | "counselorDashboard"
  | "counselorOrderDetails"
  | "counselorConsultationDetails"
  | "counselorSchedules"
  | "counselorRecords";

export interface NavigationSection {
  id: SectionId;
  label: string;
  desc: string;
  path: string;
  adminOnly?: boolean;
  allowedRoles?: Role[];
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
  sitePages?: SitePage[];
  siteGuideItems?: SiteGuideItem[];
  schedules?: ScheduleOverview;
  rooms?: Room[];
  roomStatus?: RoomStatusSnapshot;
  selectedRoom?: RoomDetail;
  selectedRoomOptions?: ScheduleRoomOptions;
  counselorRecords?: CounselorRecordSummary[];
  selectedCounselorRecords?: AdminConsultationRecord[];
  selectedCaseRecord?: AdminCaseRecordDetail;
  caseRecordAmendments?: CaseRecordAmendment[];
  operationRecords?: PagedResult<OperationRecord>;
  completedOrderImport?: CompletedOrderImportResult;
  userBoard?: PagedResult<UserBoardSummary>;
  selectedUserBoard?: UserBoardDetail;
  counselorBoard?: PagedResult<CounselorBoardSummary>;
  selectedCounselorBoard?: CounselorBoardDetail;
  counselorDashboard?: CounselorDashboardStats;
  counselorDashboardDetails?: CounselorDashboardDetailItem[];
  counselorScheduleCalendar?: CounselorScheduleCalendar;
  counselorSlotOptions?: CounselorSlotOptions;
  proxyScheduleCalendar?: ProxyScheduleCalendar;
  proxySlotOptions?: ProxySlotOptions;
  counselorCompletedConsultations?: CounselorCompletedConsultation[];
  counselorCaseRecords?: CounselorCaseRecord[];
  selectedCounselorCaseRecord?: CounselorCaseRecord;
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

export type ContentKind =
  | "banner"
  | "activity"
  | "brand"
  | "consultation_guide"
  | "charity"
  | "contact";

export interface ContentDraft {
  kind: ContentKind;
  title: string;
  body: string;
  summary: string;
  imageUrl: string;
  pageKey?: string;
}

export interface SummaryRow {
  time: string;
  type: string;
  subject: string;
  status: string;
  amount: string;
  tone?: "green" | "gold" | "red" | "neutral";
}
