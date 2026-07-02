export type Role = "Patient" | "Counselor" | "Assistant" | "Ops" | "Admin";

export interface LoginResponse {
  token: string;
  is_new_user: boolean;
}

export interface CurrentUser {
  id: number;
  openId?: string | null;
  mobile?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  realName?: string | null;
  gender?: string | null;
  roles: Role[];
  activeRole?: Role | string | null;
}

export interface OpsDashboard {
  userCount?: number;
  orderCount?: number;
  paidOrderCount?: number;
  paidAmount?: number;
  articleCount?: number;
  activityCount?: number;
}

export interface RefundExemption {
  id: number;
  consultationId: number;
  accountId: number;
  patientName: string;
  patientMobile?: string | null;
  counselorId: number;
  counselorName: string;
  amount: number;
  reason: string;
  screenshotUrl?: string | null;
  status: string;
  rejectReason?: string | null;
  consultationStartTime?: string | null;
  consultationStatus?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface AdminUser {
  id: number;
  mobile?: string | null;
  nickname?: string | null;
  activeRole?: string | null;
  roles: Role[];
}

export interface OpsUser {
  id: number;
  openId?: string | null;
  mobile?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  roles?: Role[];
}

export interface PagedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export type CompletedOrderImportStatus = "IMPORTED" | "SKIPPED" | "FAILED";

export interface CompletedOrderImportRowResult {
  rowNumber: number;
  status: CompletedOrderImportStatus;
  message: string;
  patientName?: string | null;
  counselorName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  amount?: number | null;
  orderId?: number | null;
  consultationId?: number | null;
}

export interface CompletedOrderImportResult {
  message?: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  rows: CompletedOrderImportRowResult[];
}

export interface Banner {
  Id: number;
  Title: string;
  ImageUrl: string;
  LinkType: string;
  LinkValue?: string | null;
  SortOrder: number;
  IsActive: boolean;
  StartAt?: string | null;
  EndAt?: string | null;
  CreatedAt?: string | null;
}

export interface Activity {
  Id: number;
  Type: string;
  Title: string;
  Content?: string | null;
  CoverUrl?: string | null;
  IsActive: boolean;
  StartAt?: string | null;
  EndAt?: string | null;
  SortOrder: number;
  CreatedAt?: string | null;
}

export interface Article {
  id: number;
  title: string;
  category?: string | null;
  summary?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  author?: string | null;
  source?: string | null;
  isTop?: boolean;
  isActive?: boolean;
  views?: number;
  sortOrder?: number;
  publishedAt?: string | null;
  createdAt?: string | null;
}

export interface ScheduleItem {
  scheduleId: number;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  centerId?: string | null;
  centerName?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  patientName?: string | null;
}

export interface CounselorSchedules {
  counselorId: number;
  counselorName: string;
  scheduleCount: number;
  schedules: ScheduleItem[];
}

export interface ScheduleOverview {
  date: string;
  counselors: CounselorSchedules[];
}

export interface Room {
  id?: number | null;
  centerId: string;
  centerName: string;
  roomCode: string;
  name: string;
  status: string;
}

export interface RoomStatus extends Room {
  occupancy?: string;
  label?: string;
  manualStatus?: string;
  atTime?: string | null;
  scheduleId?: number;
  counselorId?: number;
  counselorName?: string | null;
  counselorMobile?: string | null;
  patientName?: string | null;
  patientMobile?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  scheduleStatus?: string | null;
}

export interface RoomStatusSnapshot {
  date: string;
  timeSlot: string;
  isCurrentSlot: boolean;
  rooms: RoomStatus[];
}

export interface RoomDetailSlot {
  key: string;
  startTime?: string | null;
  endTime?: string | null;
  timeLabel: string;
  past: boolean;
  occupancy?: string | null;
  statusLabel?: string | null;
  manualStatus?: string | null;
  editable: boolean;
  scheduleId?: number | null;
  counselorId?: number | null;
  counselorName?: string | null;
  counselorMobile?: string | null;
  patientName?: string | null;
  patientMobile?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  scheduleStatus?: string | null;
}

export type RoomSlotManualStatus = "AVAILABLE" | "MAINTENANCE" | "DISABLED";

export interface RoomDetailDay {
  date: string;
  slots: RoomDetailSlot[];
}

export interface RoomDetail extends Room {
  current?: RoomStatus;
  startDate: string;
  endDate: string;
  days: RoomDetailDay[];
}

export interface ScheduleRoomOption {
  roomCode: string;
  roomDbId?: number | null;
  name: string;
  isCurrent: boolean;
}

export interface ScheduleRoomOptions {
  scheduleId: number;
  centerId?: string | null;
  centerName?: string | null;
  currentRoomCode?: string | null;
  currentRoomName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  options: ScheduleRoomOption[];
}

export interface CounselorRecordSummary {
  counselorId: number;
  counselorName: string;
  completedCount: number;
  recordedCount: number;
  missingCount: number;
}

export interface AdminConsultationRecord {
  consultationId: number;
  patientId: number;
  patientName: string;
  startTime?: string | null;
  endTime?: string | null;
  caseRecordId?: number | null;
  hasRecord: boolean;
  recordUpdatedAt?: string | null;
  photoCount: number;
  subjectivePreview?: string | null;
}

export interface AdminCaseRecordDetail {
  Id: number;
  ConsultationId: number;
  CounselorId: number;
  CounselorName: string;
  PatientName: string;
  StartTime?: string | null;
  EndTime?: string | null;
  Subjective?: string | null;
  Objective?: string | null;
  Assessment?: string | null;
  Plan?: string | null;
  RiskAssessment?: Record<string, unknown> | null;
  HeaderInfo?: Record<string, unknown> | null;
  PhotoUrls: string[];
  CreatedAt: string;
  UpdatedAt?: string | null;
}

export interface CaseRecordSnapshot {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  riskAssessment?: Record<string, unknown> | null;
  headerInfo?: Record<string, unknown> | null;
  photoUrls: string[];
}

export interface CaseRecordAmendment {
  id: number;
  caseRecordId: number;
  consultationId: number;
  counselorId: number;
  counselorName: string;
  reason?: string | null;
  status: string;
  rejectReason?: string | null;
  consultationStartTime?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  current: CaseRecordSnapshot;
  proposed: CaseRecordSnapshot;
}

export interface MessageItem {
  Id: number;
  AccountId: number;
  Type: string;
  Title: string;
  Content?: string | null;
  RelatedType?: string | null;
  RelatedId?: number | null;
  IsRead: boolean;
  CreatedAt: string;
  ReadAt?: string | null;
}

export interface FeedbackItem {
  id: number;
  accountId: number;
  userName?: string | null;
  userMobile?: string | null;
  category?: string | null;
  content: string;
  contact?: string | null;
  status: string;
  createdAt: string;
}

export interface OperationRecord {
  id: string;
  occurredAt?: string | null;
  actionType: string;
  actionLabel: string;
  operatorId?: number | null;
  operatorName?: string | null;
  operatorRole?: string | null;
  operatorRoles?: Role[];
  operatorContact?: string | null;
  targetType?: string | null;
  targetId?: number | null;
  targetName?: string | null;
  summary?: string | null;
  amount?: number | null;
  status?: string | null;
  patientName?: string | null;
  patientContact?: string | null;
  counselorName?: string | null;
  counselorContact?: string | null;
  patientId?: number | null;
  counselorId?: number | null;
  scheduleId?: number | null;
  centerName?: string | null;
  roomName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  relatedOrderId?: number | null;
  relatedConsultationId?: number | null;
}

export interface UserBoardSummary {
  id: number;
  name: string;
  mobile?: string | null;
  gender?: string | null;
  roles: Role[];
  activeRole?: string | null;
  orderCount: number;
  paidOrderCount: number;
  paidAmount: number;
  refundCount: number;
  refundAmount: number;
  exemptionCount: number;
  pendingExemptionCount: number;
  consultationCount: number;
  completedConsultationCount: number;
  cancelledConsultationCount: number;
  latestConsultationAt?: string | null;
  createdAt?: string | null;
}

export interface UserBoardDetail {
  profile: UserBoardSummary;
  orders: Array<{
    id: number;
    outTradeNo: string;
    transactionId?: string | null;
    totalFee: number;
    status: string;
    description?: string | null;
    createdAt?: string | null;
    paidAt?: string | null;
    updatedAt?: string | null;
  }>;
  payments: Array<{ id: number; amount: number; paidAt?: string | null; status: string }>;
  refunds: Array<{ id: number; amount: number; updatedAt?: string | null; status: string }>;
  exemptions: Array<{
    id: number;
    consultationId: number;
    amount: number;
    reason: string;
    status: string;
    rejectReason?: string | null;
    reviewedAt?: string | null;
    createdAt?: string | null;
  }>;
  consultations: Array<{
    id: number;
    orderId?: number | null;
    counselorId: number;
    counselorName: string;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    note?: string | null;
    centerName?: string | null;
    roomName?: string | null;
  }>;
  roomBookings: Array<{
    consultationId: number;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
  }>;
}

export interface CounselorBoardSummary {
  id: number;
  name: string;
  mobile?: string | null;
  activeRole?: string | null;
  consultationCount: number;
  completedConsultationCount: number;
  cancelledConsultationCount: number;
  caseRecordCount: number;
  missingRecordCount: number;
  scheduleCount: number;
  bookedScheduleCount: number;
  leaveRequestCount: number;
  latestScheduleAt?: string | null;
}

export interface AdminCounselorIntroProfile {
  counselorId: number;
  name: string;
  avatarUrl?: string | null;
  title?: string | null;
  specialty?: string | null;
  field?: string | null;
  introduce?: string | null;
  career?: string | null;
  qualification?: string | null;
  targetGroup?: string | null;
  mode?: string | null;
  workYears: number;
  consultHours: number;
  billingYuan?: number | null;
  faceBillingYuan?: number | null;
  isActive: boolean;
  infoAuthenticityCommitted?: boolean;
  infoAuthenticityCommittedAt?: string | null;
  infoAuthenticitySignerName?: string | null;
}

export interface AdminCounselorIntroUpdatePayload {
  name: string;
  avatarUrl?: string | null;
  title?: string | null;
  specialty?: string | null;
  field?: string | null;
  introduce?: string | null;
  career?: string | null;
  qualification?: string | null;
  targetGroup?: string | null;
  mode?: string | null;
  workYears?: number;
  consultHours?: number;
  isActive?: boolean;
}

export interface CounselorBoardDetail {
  profile: CounselorBoardSummary;
  visitors: Array<{
    patientId: number;
    patientName: string;
    patientMobile?: string | null;
    consultationCount: number;
    appointmentCount: number;
    cancelledCount: number;
    paidAmount: number;
    latestAppointment?: {
      consultationId: number;
      orderId?: number | null;
      scheduleId?: number | null;
      status: string;
      startTime?: string | null;
      endTime?: string | null;
      note?: string | null;
      centerName?: string | null;
      roomName?: string | null;
    } | null;
  }>;
  consultations: Array<{
    id: number;
    orderId?: number | null;
    patientId: number;
    patientName: string;
    patientMobile?: string | null;
    scheduleId?: number | null;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    note?: string | null;
    centerName?: string | null;
    roomName?: string | null;
    hasCaseRecord: boolean;
  }>;
  caseRecords: Array<{
    id: number;
    consultationId: number;
    createdAt?: string | null;
    updatedAt?: string | null;
    preview?: string | null;
    patientName?: string | null;
    patientMobile?: string | null;
    status?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
  }>;
  leaveRequests: Array<{
    id: number;
    scheduleId: number;
    reason: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
    patientName?: string | null;
    patientMobile?: string | null;
    consultationStatus?: string | null;
  }>;
  schedules: Array<{
    id: number;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
    patientName?: string | null;
    patientMobile?: string | null;
    consultationStatus?: string | null;
  }>;
  roomUsage: Array<{
    scheduleId: number;
    startTime?: string | null;
    endTime?: string | null;
    status: string;
    centerName?: string | null;
    roomName?: string | null;
    patientName?: string | null;
    patientMobile?: string | null;
    consultationStatus?: string | null;
  }>;
  scheduleCancelLogs: Array<{
    id: number;
    scheduleId: number;
    consultationId?: number | null;
    screenshotUrl?: string | null;
    createdAt?: string | null;
    patientName?: string | null;
    patientMobile?: string | null;
    status?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
    consultationStatus?: string | null;
  }>;
}

export interface CounselorDashboardStats {
  totalConsultations?: number;
  monthConsultations?: number;
  pendingConsultations?: number;
  doneConsultations?: number;
  estimatedRevenue?: number;
  completedOrderCount?: number;
  completedOrderRevenue?: number;
  caseRecordCount?: number;
  totalAppointments?: number;
  leaveCount?: number;
}

export interface CounselorDashboardDetailItem {
  id: number;
  title: string;
  subtitle?: string | null;
  extra?: string | null;
  amount?: number | null;
  consultationId?: number | null;
  caseRecordId?: number | null;
  status?: string | null;
}

export interface CounselorScheduleCalendarItem {
  id: number;
  startTime: string;
  endTime: string;
  status: string;
  displayStatus: string;
  displayLabel: string;
  centerId?: string | null;
  centerName?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  patientName?: string | null;
  consultationId?: number | null;
  consultationStatus?: string | null;
  canCancel: boolean;
  requiresLeave: boolean;
  cancelHint?: string | null;
  leaveRequestId?: number | null;
  leaveReason?: string | null;
  leaveSubmittedAt?: string | null;
  leaveStatus?: string | null;
  hasCaseRecord: boolean;
  caseRecordId?: number | null;
}

export interface CounselorScheduleCalendar {
  startDate: string;
  days: number;
  slots: CounselorScheduleCalendarItem[];
}

export interface CounselorSlotRoomOption {
  roomId: string;
  roomName: string;
  available: boolean;
  occupiedBySelf: boolean;
  occupiedByOther: boolean;
  otherCounselorId?: number | null;
}

export interface CounselorSlotOption {
  key: string;
  startTime: string;
  endTime: string;
  label: string;
  past: boolean;
  counselorOccupied: boolean;
  counselorScheduleId?: number | null;
  allRoomsFull: boolean;
  rooms: CounselorSlotRoomOption[];
}

export interface CounselorSlotOptions {
  date: string;
  centerId: string;
  centerName: string;
  slots: CounselorSlotOption[];
}

export interface CounselorCompletedConsultation {
  Id: number;
  PatientId: number;
  PatientName: string;
  StartTime?: string | null;
  EndTime?: string | null;
  Note?: string | null;
  CaseRecordId?: number | null;
  HasRecord: boolean;
  RecordUpdatedAt?: string | null;
  PhotoCount: number;
}

export interface CounselorCaseRecord {
  Id: number;
  ConsultationId: number;
  CounselorId: number;
  Subjective?: string | null;
  Objective?: string | null;
  Assessment?: string | null;
  Plan?: string | null;
  RiskAssessment?: Record<string, unknown> | null;
  HeaderInfo?: Record<string, string> | null;
  PhotoUrls: string[];
  CreatedAt: string;
  UpdatedAt?: string | null;
  AmendmentStatus?: string | null;
  AmendmentId?: number | null;
  AmendmentRejectReason?: string | null;
}

export interface CounselorCaseRecordRevision {
  Id: number;
  CaseRecordId: number;
  ConsultationId: number;
  Subjective?: string | null;
  Objective?: string | null;
  Assessment?: string | null;
  Plan?: string | null;
  RiskAssessment?: Record<string, unknown> | null;
  HeaderInfo?: Record<string, unknown> | null;
  PhotoUrls: string[];
  RevisedAt: string;
  RevisedBy: number;
}

export interface CounselorCaseRecordFormDefaults {
  ConsultationId: number;
  HeaderInfo: Record<string, string>;
}

export interface ApiMessage {
  message?: string;
  msg?: string;
  status?: string;
  code?: number;
}
