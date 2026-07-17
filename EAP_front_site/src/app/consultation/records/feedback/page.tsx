import { Suspense } from "react";
import { PageHero } from "@/components/layout/page-hero";
import { ConsultationFeedbackClient } from "@/components/booking/consultation-feedback-client";

export default function ConsultationFeedbackPage() {
  return (
    <>
      <PageHero title="咨询反馈" subtitle="您的反馈将帮助我们持续改进服务" />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Suspense fallback={<p className="text-center text-muted-foreground">加载中…</p>}>
          <ConsultationFeedbackClient />
        </Suspense>
      </section>
    </>
  );
}
