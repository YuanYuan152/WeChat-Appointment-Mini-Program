import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAssessment } from "@/lib/assessment/api";
import { QuizClient } from "@/components/assessment/quiz-client";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";
import { ProfessionalAssessmentPrivacyGate } from "@/components/assessment/professional-assessment-privacy";
import { AssessmentShareAttribution } from "@/components/assessment/assessment-share-attribution";
import { AssessmentShareButton } from "@/components/assessment/assessment-share-button";

interface QuizPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ shareCode?: string | string[] }>;
}

export default async function ProfessionalQuizPage({ params, searchParams }: QuizPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const assessment = await getAssessment(id, "professional");

  if (!assessment) notFound();
  const incomingShareCode =
    typeof query.shareCode === "string" ? query.shareCode : null;

  return (
    <section className="px-4 pb-16 pt-24 sm:px-6">
      <AssessmentShareAttribution
        assessmentId={assessment.id}
        assessmentVersion={assessment.version ?? 1}
        expectedShareCode={assessment.shareCode}
        incomingShareCode={incomingShareCode}
      />
      <div className="mx-auto max-w-2xl">
        <Link
          href="/assessment/professional"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-bold">{assessment.title}</h1>
          <AssessmentShareButton assessment={assessment} />
        </div>
        <AssessmentAuthGate requireUser>
          <ProfessionalAssessmentPrivacyGate>
            <QuizClient assessment={assessment} type="professional" />
          </ProfessionalAssessmentPrivacyGate>
        </AssessmentAuthGate>
      </div>
    </section>
  );
}
