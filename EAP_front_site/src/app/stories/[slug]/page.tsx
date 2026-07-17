import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ChapterSection } from "@/components/stories/chapter-section";

interface StoryDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { slug } = await params;
  const story = await api.getStoryBySlug(slug);

  if (!story) notFound();

  return (
    <article>
      <div className="relative h-[50vh] min-h-[360px]">
        <Image
          src={story.cover}
          alt={story.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-12 pt-28 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/stories"
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Link>
            <div className="mb-3 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <h1 className="font-serif text-3xl font-bold sm:text-4xl">{story.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{story.subtitle}</p>
            <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{story.readMinutes} 分钟阅读</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {story.chapters.map((chapter, i) => (
          <ChapterSection key={i} chapter={chapter} index={i} />
        ))}
      </div>
    </article>
  );
}
