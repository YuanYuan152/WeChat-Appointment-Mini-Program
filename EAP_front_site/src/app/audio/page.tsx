import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { EpisodeCard } from "@/components/audio/episode-card";

export default async function AudioPage() {
  const episodes = await api.getAudioEpisodes();

  const seriesMap = episodes.reduce<Record<string, typeof episodes>>((acc, ep) => {
    if (!acc[ep.series]) acc[ep.series] = [];
    acc[ep.series].push(ep);
    return acc;
  }, {});

  return (
    <>
      <PageHero
        title="心理音画"
        subtitle="戴上耳机，让声音成为你的疗愈伙伴。点击播放，看光碟旋转，聆听内心的回响。"
      />
      <section className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
        {Object.entries(seriesMap).map(([series, eps]) => (
          <div key={series}>
            <h2 className="mb-4 font-serif text-xl font-semibold">{series}</h2>
            <div className="space-y-3">
              {eps.map((ep, i) => (
                <EpisodeCard key={ep.id} episode={ep} index={i} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
