import { Suspense } from "react";
import { PageHero } from "@/components/layout/page-hero";
import { RefundExemptionClient } from "@/components/booking/refund-exemption-client";

export default function RefundExemptionPage() {
  return (
    <>
      <PageHero title="退款豁免申请" subtitle="特殊情况下的退款审核申请" />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Suspense fallback={<p className="text-center text-muted-foreground">加载中…</p>}>
          <RefundExemptionClient />
        </Suspense>
      </section>
    </>
  );
}
