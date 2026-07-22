import { listAssessments } from "@/lib/assessment/api";
import { PageHero } from "@/components/layout/page-hero";
import { AssessmentCard } from "@/components/assessment/assessment-card";
import { AssessmentReportsLink } from "@/components/assessment/assessment-reports-link";
import { AssessmentLoginNotice } from "@/components/assessment/assessment-login-notice";

export default async function FunAssessmentPage() {
  const assessments = await listAssessments("fun");

  return (
    <>
      <PageHero
        title="趣味测评"
        subtitle="轻松有趣的心理探索，在玩乐中发现关于自己的小小惊喜。"
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <AssessmentReportsLink />
        <AssessmentLoginNotice />
        <div className="space-y-6">
        {assessments.map((a, i) => (
          <AssessmentCard key={a.id} assessment={a} type="fun" index={i} />
        ))}
        </div>
      </section>
    </>
  );
}
