import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { AssessmentReportsList } from "@/components/assessment/assessment-reports-list";

export default function AssessmentReportsPage() {
  return (
    <>
      <PageHero
        title="测评报告"
        subtitle="查看您已完成的心理测评记录与详细评估结果。报告与您的登录账号关联，仅您本人可见。"
      />
      <div className="mx-auto max-w-4xl px-4 pb-4 sm:px-6">
        <Link
          href="/assessment"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回心理测评
        </Link>
      </div>
      <AssessmentReportsList />
    </>
  );
}
