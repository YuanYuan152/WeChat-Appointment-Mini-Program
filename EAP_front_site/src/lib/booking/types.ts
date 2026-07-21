import type { BookingTimeSlot } from "./slots";

export interface CounselorListItem {
  id: number;
  name: string;
  avatarUrl?: string | null;
  title?: string | null;
  specialty?: string | null;
  field?: string | null;
  introduce?: string | null;
  billing: number;
  consultHours: number;
  workYears: number;
  province?: string;
  _source?: string;
}

export interface CounselorDetail extends CounselorListItem {
  profile?: string | null;
  career?: string | null;
  qualification?: string | null;
  targetGroup?: string | null;
  mode?: string | null;
  timeSlots?: BookingTimeSlot[];
  availableCenterIds?: string[];
  hasAvailableTime?: boolean;
}

export interface CounselorListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: CounselorListItem[];
}

export interface TimeSlotsResponse {
  counselorId: number;
  timeSlots: BookingTimeSlot[];
  availableCenterIds: string[];
  hasAvailableTime: boolean;
}

export interface PatientProfile {
  id: number;
  mobile?: string | null;
  nickname?: string | null;
  needsIntakeAgreement?: boolean;
  emergencyContact?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
}

export interface SimulatePayResponse {
  order_id: number;
  out_trade_no: string;
  status: string;
}

export interface ConsultationRecord {
  id: number;
  orderId?: number | null;
  counselorId: number;
  counselorName: string;
  counselorAvatar?: string | null;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  createdAt?: string | null;
  centerId?: string | null;
  centerName?: string | null;
  canCancel?: boolean;
  refundEligible?: boolean;
  orderAmount?: number | null;
  refundReason?: string | null;
  exemptionStatus?: string | null;
  exemptionRejectReason?: string | null;
  exemptionId?: number | null;
  cancelSummary?: string | null;
  hasFeedback?: boolean;
  feedbackContent?: string | null;
  feedbackAt?: string | null;
  feedbackGoalScore?: number | null;
  feedbackRhythmScore?: number | null;
  feedbackImprovements?: string[] | null;
}

export interface MessageItem {
  id: number;
  accountId: number;
  type: string;
  title: string;
  content?: string | null;
  relatedType?: string | null;
  relatedId?: number | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface ConsultationFeedbackPayload {
  goalScore?: number | null;
  rhythmScore?: number | null;
  improvements?: string[];
}

export interface RefundExemptionPayload {
  amount: number;
  reason: string;
  screenshot_url?: string;
}

export interface CancelConsultationResult {
  refunded: boolean;
  message: string;
}
