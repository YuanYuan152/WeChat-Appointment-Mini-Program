import { PageHero } from "@/components/layout/page-hero";
import { MessagesClient } from "@/components/booking/messages-client";

export default function ConsultationMessagesPage() {
  return (
    <>
      <PageHero title="我的消息" subtitle="预约通知、活动提醒与审核结果" />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <MessagesClient />
      </section>
    </>
  );
}
