import { redirect } from "next/navigation";
import { consultationDetailPath } from "@/lib/booking/paths";

interface ConsultantDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}

/** 兼容旧链接 /consultation/123 → /consultation?id=123 */
export default async function ConsultantDetailRedirectPage({
  params,
  searchParams,
}: ConsultantDetailPageProps) {
  const { id } = await params;
  const { source } = await searchParams;
  const counselorId = Number(id);

  if (!Number.isFinite(counselorId) || counselorId <= 0) {
    redirect("/consultation");
  }

  redirect(consultationDetailPath(counselorId, source));
}
