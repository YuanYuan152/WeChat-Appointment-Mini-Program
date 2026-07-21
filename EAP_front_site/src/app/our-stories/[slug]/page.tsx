import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, User, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { OurStorySectionView } from "@/components/our-stories/our-story-section";
import {
  getOurStoryBadgeVariant,
  getOurStoryListHref,
  getOurStoryTypeLabel,
} from "@/lib/our-stories/utils";

interface OurStoryDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OurStoryDetailPage({ params }: OurStoryDetailPageProps) {
  const { slug } = await params;
  const story = await api.getOurStoryBySlug(slug);

  if (!story) notFound();

  const backHref = getOurStoryListHref(story.type);
  const typeLabel = getOurStoryTypeLabel(story.type);

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
              href={backHref}
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              返回{typeLabel}
            </Link>
            <Badge variant={getOurStoryBadgeVariant(story.type)}>
              {typeLabel}
            </Badge>
            <h1 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
              {story.title}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">{story.subtitle}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {story.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {story.readMinutes} 分钟阅读
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-10 rounded-[var(--radius)] border border-border bg-muted/30 p-6">
          <div className="mb-3 flex items-center gap-2 font-serif font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {story.type === "counselor" ? "案例要点" : "故事亮点"}
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {story.highlights.map((h) => (
              <li
                key={h}
                className="rounded-xl bg-card px-4 py-3 text-center text-sm text-muted-foreground"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>

        <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
          {story.excerpt}
        </p>

        {story.sections.map((section, i) => (
          <OurStorySectionView key={i} section={section} index={i} />
        ))}

        {story.type === "counselor" && (
          <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            本文所载案例均经来访者知情同意，个人信息与细节已做脱敏与改编处理，仅供心理健康科普参考，不构成诊疗建议。
          </p>
        )}
      </div>
    </article>
  );
}
