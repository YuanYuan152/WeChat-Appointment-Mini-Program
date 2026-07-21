import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Headphones,
  Phone,
  ClipboardList,
  ArrowRight,
  Heart,
  MessageCircleQuestion,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StoryCard } from "@/components/stories/story-card";
import { EpisodeCard } from "@/components/audio/episode-card";
import { QaCard } from "@/components/qa/qa-card";
import { OurStoryCard } from "@/components/our-stories/our-story-card";

const modules = [
  {
    href: "/stories",
    icon: BookOpen,
    title: "心理图文",
    description: "故事化的图文阅读，在文字与画面中找到共鸣",
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/qa",
    icon: MessageCircleQuestion,
    title: "心理问答",
    description: "真实困惑与专业解答，一问一答温暖相伴",
    color: "bg-secondary/10 text-secondary",
  },
  {
    href: "/our-stories",
    icon: Users,
    title: "我们的故事",
    description: "来访者的重生、学员的成长与咨询师手记",
    color: "bg-accent/20 text-accent-foreground",
  },
  {
    href: "/audio",
    icon: Headphones,
    title: "心理音画",
    description: "播客音频疗愈，光碟转动间聆听内心",
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/consultation",
    icon: Phone,
    title: "预约咨询",
    description: "选择咨询师与时段，在线预约线下或视频咨询",
    color: "bg-secondary/10 text-secondary",
  },
  {
    href: "/assessment",
    icon: ClipboardList,
    title: "心理测评",
    description: "专业量表与趣味探索，认识真实的自己",
    color: "bg-accent/20 text-accent-foreground",
  },
];

export default async function HomePage() {
  const [stories, episodes, qaItems, ourStories] = await Promise.all([
    api.getStories(),
    api.getAudioEpisodes(),
    api.getQaItems(),
    api.getOurStories(),
  ]);

  const featuredStories = stories.slice(0, 2);
  const featuredEpisodes = episodes.slice(0, 3);
  const featuredQa = qaItems.slice(0, 2);
  const featuredOurStories = ourStories.slice(0, 3);

  return (
    <>
      <section className="gradient-hero relative flex min-h-[85vh] items-center px-4 pt-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <Heart className="h-4 w-4" />
              温暖 · 专业 · 陪伴
            </div>
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              在这里，
              <br />
              <span className="text-primary">被温柔地听见</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              连心心理致力于用专业的心理学知识和温暖的陪伴，
              为每一个渴望被理解的心灵，搭建一座通往内在的桥梁。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/consultation">
                <Button size="lg" className="rounded-full px-8">
                  预约咨询
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/stories">
                <Button size="lg" variant="outline" className="rounded-full px-8">
                  开始阅读
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative hidden aspect-square lg:block">
            <div className="absolute inset-0 rounded-full bg-primary/5" />
            <div className="absolute inset-8 overflow-hidden rounded-[2rem] shadow-2xl">
              <Image
                src="/images/brand/steve.jpg"
                alt="温馨心理咨询"
                fill
                className="object-cover"
                priority
                sizes="500px"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 rounded-2xl border border-border bg-card/90 p-4 shadow-lg backdrop-blur-sm">
              <p className="font-serif text-2xl font-bold text-primary">12+</p>
              <p className="text-xs text-muted-foreground">年专业经验</p>
            </div>
            <div className="absolute -right-4 -top-4 rounded-2xl border border-border bg-card/90 p-4 shadow-lg backdrop-blur-sm">
              <p className="font-serif text-2xl font-bold text-secondary">5000+</p>
              <p className="text-xs text-muted-foreground">服务来访者</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-bold">探索我们的服务</h2>
          <p className="mt-3 text-muted-foreground">
            七大模块，覆盖阅读、问答、故事、聆听、咨询与测评
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group">
              <div className="h-full rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${mod.color}`}
                >
                  <mod.icon className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold group-hover:text-primary">
                  {mod.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mod.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold">心理问答</h2>
              <p className="mt-2 text-muted-foreground">来访者的困惑，咨询师的专业解答</p>
            </div>
            <Link
              href="/qa"
              className="hidden items-center gap-1 text-sm text-primary hover:underline sm:flex"
            >
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {featuredQa.map((item, i) => (
              <QaCard key={item.id} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold">我们的故事</h2>
            <p className="mt-2 text-muted-foreground">来访者的重生、学员的成长与咨询师手记</p>
          </div>
          <Link
            href="/our-stories"
            className="hidden items-center gap-1 text-sm text-primary hover:underline sm:flex"
          >
            查看全部 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredOurStories.map((story, i) => (
            <OurStoryCard key={story.id} story={story} index={i} />
          ))}
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold">精选图文</h2>
              <p className="mt-2 text-muted-foreground">故事化的心理阅读体验</p>
            </div>
            <Link
              href="/stories"
              className="hidden items-center gap-1 text-sm text-primary hover:underline sm:flex"
            >
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {featuredStories.map((story, i) => (
              <StoryCard key={story.id} story={story} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl font-bold">热门音频</h2>
            <p className="mt-2 text-muted-foreground">点击播放，让光碟旋转起来</p>
          </div>
          <Link
            href="/audio"
            className="hidden items-center gap-1 text-sm text-primary hover:underline sm:flex"
          >
            查看全部 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {featuredEpisodes.map((ep, i) => (
            <EpisodeCard key={ep.id} episode={ep} index={i} />
          ))}
        </div>
      </section>

      <section className="gradient-warm px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-3xl font-bold">我们的理念</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            我们相信，每一个渴望被理解的心灵都值得被温柔以待。
            心理咨询不是「治病」，而是一段共同探索的旅程——
            在这里，你不必坚强，只需真实。
          </p>
          <Link href="/consultation" className="mt-8 inline-block">
            <Button size="lg" className="rounded-full px-8">
              开启你的旅程
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
