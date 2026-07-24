export interface AssessmentShareStatsItem {
  assessmentId: string;
  assessmentTitle: string;
  scanCount: number;
  uniqueScanCount: number;
  completedReportCount: number;
  conversionRate: number;
}

export interface AssessmentShareStats {
  scanCount: number;
  uniqueScanCount: number;
  completedReportCount: number;
  conversionRate: number;
  items: AssessmentShareStatsItem[];
}

export interface AssessmentShareStatsFilters {
  assessmentId?: string;
  startAt?: string;
  endAt?: string;
}
