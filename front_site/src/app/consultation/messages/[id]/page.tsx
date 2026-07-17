import { MessageDetailClient } from "@/components/booking/message-detail-client";

export const dynamic = "force-dynamic";

interface MessageDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MessageDetailPage({ params }: MessageDetailPageProps) {
  const { id } = await params;
  const messageId = Number(id);

  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6">
      <MessageDetailClient messageId={messageId} />
    </section>
  );
}
