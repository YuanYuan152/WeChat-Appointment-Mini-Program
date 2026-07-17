import { ReportDetailClient } from "@/components/assessment/report-detail-client";

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function AssessmentReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = await params;
  return <ReportDetailClient reportId={reportId} />;
}
