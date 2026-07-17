import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ConsultationPortalToolbar } from "@/components/booking/consultation-portal-toolbar";
import { CounselorListClient } from "@/components/booking/counselor-list-client";
import { CounselorDetailClient } from "@/components/booking/counselor-detail-client";

export const dynamic = "force-dynamic";

interface ConsultationPageProps {
  searchParams: Promise<{ id?: string; source?: string }>;
}

export default async function ConsultationPage({ searchParams }: ConsultationPageProps) {
  const { id, source } = await searchParams;
  const counselorId = id ? Number(id) : NaN;
  const showDetail = Number.isFinite(counselorId) && counselorId > 0;

  if (showDetail) {
    return (
      <section className="px-4 pb-16 pt-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/consultation"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回咨询师列表
          </Link>
          <CounselorDetailClient counselorId={counselorId} source={source} />
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHero
        title="预约咨询"
        subtitle="选择专业咨询师，在线预约线下或视频咨询时段，与小程序来访流程一致。"
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <ConsultationPortalToolbar />
        <CounselorListClient />
      </section>
    </>
  );
}
