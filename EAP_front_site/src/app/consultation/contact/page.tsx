import { PageHero } from "@/components/layout/page-hero";
import { ContactAssistantContent } from "@/components/booking/contact-assistant-content";

export default function ConsultationContactPage() {
  return (
    <>
      <PageHero
        title="联系助理"
        subtitle="预约咨询、改期与疑问，欢迎联系我们的咨询助理"
      />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ContactAssistantContent />
      </section>
    </>
  );
}
