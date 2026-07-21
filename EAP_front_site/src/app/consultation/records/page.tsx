import { Suspense } from "react";
import { PageHero } from "@/components/layout/page-hero";
import { ConsultationRecordsClient } from "@/components/booking/consultation-records-client";

export default function ConsultationRecordsPage() {
  return (
    <>
      <PageHero title="我的预约" subtitle="查看与管理您的心理咨询预约" />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Suspense fallback={<p className="text-center text-muted-foreground">加载中…</p>}>
          <ConsultationRecordsClient />
        </Suspense>
      </section>
    </>
  );
}
