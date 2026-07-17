import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { StoryCard } from "@/components/stories/story-card";

export default async function StoriesPage() {
  const stories = await api.getStories();

  return (
    <>
      <PageHero
        title="心理图文"
        subtitle="用故事化的方式，陪伴你探索内心的风景。每一篇文章都是一次温柔的对话。"
      />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story, i) => (
            <StoryCard key={story.id} story={story} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
