import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfessionalAssessmentEntry } from "@/components/assessment/professional-assessment-privacy";
import { AssessmentReportsEntry } from "@/components/assessment/assessment-reports-entry";

export default function AssessmentPage() {
  return (
    <>
      <PageHero
        title="心理测评"
        subtitle="登录后即可开始测评，报告将保存在您的账号下。所有结果仅供参考，如需帮助请寻求专业咨询。"
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <ProfessionalAssessmentEntry />

          <Link href="/assessment/fun" className="group">
            <div className="rounded-[var(--radius)] border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h2 className="font-serif text-xl font-semibold group-hover:text-primary">
                趣味测评
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                轻松有趣的心理探索：光明与黑暗人格测试，从趣味视角了解关系中的自己与他人。
              </p>
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "mt-6 pointer-events-none"
                )}
              >
                进入趣味测评
              </span>
            </div>
          </Link>
        </div>

        <AssessmentReportsEntry />
      </section>
    </>
  );
}
