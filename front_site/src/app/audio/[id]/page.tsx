import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { AudioDetailClient } from "@/components/audio/audio-detail-client";

interface AudioDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AudioDetailPage({ params }: AudioDetailPageProps) {
  const { id } = await params;
  const episode = await api.getAudioEpisodeById(id);

  if (!episode) notFound();

  return (
    <section className="gradient-warm px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/audio"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <AudioDetailClient episode={episode} />
      </div>
    </section>
  );
}
