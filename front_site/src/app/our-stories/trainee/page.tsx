import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { StoryTypeTabs } from "@/components/our-stories/story-type-tabs";
import { OurStoryCard } from "@/components/our-stories/our-story-card";

export default async function TraineeStoriesPage() {
  const stories = await api.getOurStories("trainee");

  return (
    <>
      <PageHero
        title="学员故事"
        subtitle="从学习者到助人者，他们用行动证明：成为心理咨询师，既能实现社会价值，也能获得经济独立。"
      >
        <StoryTypeTabs active="trainee" />
      </PageHero>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story, i) => (
            <OurStoryCard key={story.id} story={story} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
