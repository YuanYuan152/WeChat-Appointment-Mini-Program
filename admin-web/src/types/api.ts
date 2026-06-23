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

export interface CounselorRecordSummary {
  counselorId: number;
  counselorName: string;
  completedCount: number;
  recordedCount: number;
  missingCount: number;
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
  counselorName?: string | null;
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
  caseRecordCount: number;
  missingRecordCount: number;
  scheduleCount: number;
  bookedScheduleCount: number;
  leaveRequestCount: number;
  latestScheduleAt?: string | null;
}

export interface CounselorBoardDetail {
  profile: CounselorBoardSummary;
  consultations: Array<{
    id: number;
    patientId: number;
    patientName: string;
    patientMobile?: string | null;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    hasCaseRecord: boolean;
  }>;
  caseRecords: Array<{
    id: number;
    consultationId: number;
    createdAt?: string | null;
    updatedAt?: string | null;
    preview?: string | null;
  }>;
  leaveRequests: Array<{
    id: number;
    scheduleId: number;
    reason: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  schedules: Array<{
    id: number;
    status: string;
    startTime?: string | null;
    endTime?: string | null;
    centerName?: string | null;
    roomName?: string | null;
  }>;
  roomUsage: Array<{
    scheduleId: number;
    startTime?: string | null;
    endTime?: string | null;
    status: string;
    centerName?: string | null;
    roomName?: string | null;
  }>;
}

export interface ApiMessage {
  message?: string;
  msg?: string;
  status?: string;
  code?: number;
}
