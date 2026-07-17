import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { StoryTypeTabs } from "@/components/our-stories/story-type-tabs";
import { OurStoryCard } from "@/components/our-stories/our-story-card";

export default async function VisitorStoriesPage() {
  const stories = await api.getOurStories("visitor");

  return (
    <>
      <PageHero
        title="来访故事"
        subtitle="每一个走进咨询室的来访者，都带着勇气。这些故事记录了他们从困惑到重生的心路历程。"
      >
        <StoryTypeTabs active="visitor" />
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
