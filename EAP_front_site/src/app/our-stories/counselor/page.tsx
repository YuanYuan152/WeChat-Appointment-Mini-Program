import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { StoryTypeTabs } from "@/components/our-stories/story-type-tabs";
import { OurStoryCard } from "@/components/our-stories/our-story-card";

export default async function CounselorStoriesPage() {
  const stories = await api.getOurStories("counselor");

  return (
    <>
      <PageHero
        title="咨询师手记"
        subtitle="以第一人称视角记录咨询室里的真实案例——治疗思路、过程转折与康复足迹。所有案例均经脱敏处理。"
      >
        <StoryTypeTabs active="counselor" />
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
