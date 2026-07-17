"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { useAudioPlayer } from "@/lib/stores/audio-player";
import { formatDuration, formatPlayCount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AudioEpisode } from "@/lib/api/types";

interface EpisodeCardProps {
  episode: AudioEpisode;
  index?: number;
}

export function EpisodeCard({ episode, index = 0 }: EpisodeCardProps) {
  const { currentTrack, isPlaying, setTrack } = useAudioPlayer();
  const isCurrent = currentTrack?.id === episode.id;
  const playing = isCurrent && isPlaying;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="group flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card p-4 transition-all hover:shadow-md"
    >
      <Link href={`/audio/${episode.id}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <Image src={episode.cover} alt={episode.title} fill className="object-cover" sizes="80px" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/audio/${episode.id}`}>
          <h3 className="truncate font-medium group-hover:text-primary">{episode.title}</h3>
        </Link>
        <p className="text-xs text-muted-foreground">{episode.series}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDuration(episode.duration)}</span>
          <span className="flex items-center gap-1">
            <Headphones className="h-3 w-3" />
            {formatPlayCount(episode.playCount)}
          </span>
        </div>
      </div>

      <Button
        variant={playing ? "default" : "outline"}
        size="icon"
        className="shrink-0 rounded-full"
        onClick={() => setTrack(episode)}
      >
        <Play className={`h-4 w-4 ${playing ? "" : "ml-0.5"}`} />
      </Button>
    </motion.div>
  );
}
