import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { QaCard } from "@/components/qa/qa-card";

export default async function QaPage() {
  const items = await api.getQaItems();

  return (
    <>
      <PageHero
        title="心理问答"
        subtitle="真实的心理困惑，专业的咨询师解答。每一问一答，都是一次温暖的陪伴。"
      />
      <section className="mx-auto max-w-3xl space-y-5 px-4 py-12 sm:px-6">
        {items.map((item, i) => (
          <QaCard key={item.id} item={item} index={i} />
        ))}
      </section>
    </>
  );
}
