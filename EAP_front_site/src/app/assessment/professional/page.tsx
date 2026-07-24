import { listAssessments } from "@/lib/assessment/api";
import { PageHero } from "@/components/layout/page-hero";
import { AssessmentCard } from "@/components/assessment/assessment-card";
import { AssessmentReportsLink } from "@/components/assessment/assessment-reports-link";
import { AssessmentLoginNotice } from "@/components/assessment/assessment-login-notice";

export default async function ProfessionalAssessmentPage() {
  const assessments = await listAssessments("professional");

  return (
    <>
      <PageHero
        title="专业测评"
        subtitle="基于国际认可的心理量表，帮助您了解近期的心理健康状况。"
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <AssessmentReportsLink />
        <AssessmentLoginNotice />
        <div className="space-y-6">
          {assessments.map((a, i) => (
            <AssessmentCard key={a.id} assessment={a} type="professional" index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
