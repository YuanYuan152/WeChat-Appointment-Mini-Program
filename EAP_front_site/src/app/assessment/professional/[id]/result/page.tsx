import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { ResultClient } from "@/components/assessment/result-client";
import { AssessmentAuthGate } from "@/components/assessment/assessment-auth-gate";

interface ResultPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfessionalResultPage({ params }: ResultPageProps) {
  const { id } = await params;
  const assessment = await api.getAssessmentById(id, "professional");

  if (!assessment) notFound();

  return (
    <section className="px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/assessment/professional"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <h1 className="mb-8 text-center font-serif text-2xl font-bold">
          {assessment.title} · 测评报告
        </h1>
        <AssessmentAuthGate requireUser>
          <ResultClient assessment={assessment} type="professional" />
        </AssessmentAuthGate>
      </div>
    </section>
  );
}
