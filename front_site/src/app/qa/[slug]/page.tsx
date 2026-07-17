import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircleQuestion, ThumbsUp } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface QaDetailPageProps {
  params: Promise<{ slug: string }>;
}

function renderAnswer(text: string) {
  return text.split("\n\n").map((block, i) => {
    if (block.startsWith("**") && block.includes("**")) {
      const lines = block.split("\n");
      return (
        <div key={i} className="mb-4">
          {lines.map((line, j) => {
            const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
            if (boldMatch) {
              return (
                <p key={j} className="mb-2 font-medium text-foreground">
                  {boldMatch[1]}{boldMatch[2]}
                </p>
              );
            }
            return (
              <p key={j} className="mb-1 text-muted-foreground">
                {line}
              </p>
            );
          })}
        </div>
      );
    }
    return (
      <p key={i} className="mb-4 leading-relaxed text-muted-foreground">
        {block}
      </p>
    );
  });
}

export default async function QaDetailPage({ params }: QaDetailPageProps) {
  const { slug } = await params;
  const item = await api.getQaBySlug(slug);

  if (!item) notFound();

  return (
    <section className="px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/qa"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回问答列表
        </Link>

        <div className="mb-6 flex flex-wrap gap-2">
          <Badge variant="secondary">{item.category}</Badge>
          {item.tags.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>

        <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <MessageCircleQuestion className="mt-1 h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{item.askerAlias} 提问</p>
              <h1 className="mt-1 font-serif text-2xl font-bold leading-snug">
                {item.question}
              </h1>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-primary/20">
              <Image
                src={item.counselorAvatar}
                alt={item.counselorName}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold">{item.counselorName}</p>
              <p className="text-sm text-muted-foreground">{item.counselorTitle} · 回答</p>
            </div>
          </div>
          <div className="text-base">{renderAnswer(item.answer)}</div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            {item.helpfulCount} 人觉得有帮助
          </span>
          <span>发布于 {item.publishedAt}</span>
        </div>

        <div className="mt-8 rounded-[var(--radius)] border border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          以上内容仅供参考，不能替代专业心理咨询。如有需要，欢迎
          <Link href="/consultation" className="mx-1 text-primary hover:underline">
            预约咨询
          </Link>
          获取一对一专业帮助。
        </div>
      </div>
    </section>
  );
}
