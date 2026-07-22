import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAssessment } from "@/lib/assessment/api";
import { QuizClient } from "@/components/assessment/quiz-client";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

export default async function FunQuizPage({ params }: QuizPageProps) {
  const { id } = await params;
  const assessment = await getAssessment(id, "fun");

  if (!assessment) notFound();

  return (
    <section className="px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/assessment/fun"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <h1 className="mb-8 font-serif text-2xl font-bold">{assessment.title}</h1>
        <AssessmentAuthGate requireUser>
          <QuizClient assessment={assessment} type="fun" />
        </AssessmentAuthGate>
      </div>
    </section>
  );
}
