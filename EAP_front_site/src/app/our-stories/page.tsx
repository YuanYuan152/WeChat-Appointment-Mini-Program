import Link from "next/link";
import { Users, GraduationCap, NotebookPen } from "lucide-react";
import { api } from "@/lib/api";
import { PageHero } from "@/components/layout/page-hero";
import { StoryTypeTabs } from "@/components/our-stories/story-type-tabs";
import { OurStoryCard } from "@/components/our-stories/our-story-card";

export default async function OurStoriesPage() {
  const stories = await api.getOurStories();
  const visitorCount = stories.filter((s) => s.type === "visitor").length;
  const traineeCount = stories.filter((s) => s.type === "trainee").length;
  const counselorCount = stories.filter((s) => s.type === "counselor").length;

  return (
    <>
      <PageHero
        title="我们的故事"
        subtitle="每一个改变都值得被记录。来访者的重生、学员的成长、咨询师的手记，汇聚成连心心理最温暖的篇章。"
      >
        <StoryTypeTabs active="all" />
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/our-stories/visitor"
            className="group rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-serif text-xl font-semibold group-hover:text-primary">
              来访故事
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              看见来访者如何通过心理咨询，获得新的生活姿态与内心平静。
            </p>
            <p className="mt-3 text-sm font-medium text-primary">{visitorCount} 篇故事</p>
          </Link>
          <Link
            href="/our-stories/trainee"
            className="group rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20">
              <GraduationCap className="h-6 w-6 text-accent-foreground" />
            </div>
            <h2 className="font-serif text-xl font-semibold group-hover:text-primary">
              学员故事
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              聆听学员如何通过系统培训成为心理咨询师，实现社会价值与经济独立。
            </p>
            <p className="mt-3 text-sm font-medium text-primary">{traineeCount} 篇故事</p>
          </Link>
          <Link
            href="/our-stories/counselor"
            className="group rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:col-span-2 lg:col-span-1"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10">
              <NotebookPen className="h-6 w-6 text-secondary" />
            </div>
            <h2 className="font-serif text-xl font-semibold group-hover:text-primary">
              咨询师手记
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              以咨询师视角记录咨询案例，呈现治疗过程与来访者的康复历程。
            </p>
            <p className="mt-3 text-sm font-medium text-primary">{counselorCount} 篇手记</p>
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story, i) => (
            <OurStoryCard key={story.id} story={story} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
