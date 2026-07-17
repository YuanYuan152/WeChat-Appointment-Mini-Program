"use client";

import { Play, Pause } from "lucide-react";
import { useAudioPlayer } from "@/lib/stores/audio-player";
import { formatDuration, formatPlayCount } from "@/lib/utils";
import { VinylDisc } from "./vinyl-disc";
import { Button } from "@/components/ui/button";
import type { AudioEpisode } from "@/lib/api/types";

interface AudioDetailClientProps {
  episode: AudioEpisode;
}

export function AudioDetailClient({ episode }: AudioDetailClientProps) {
  const { currentTrack, isPlaying, setTrack, togglePlay } = useAudioPlayer();
  const isCurrent = currentTrack?.id === episode.id;
  const playing = isCurrent && isPlaying;

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      setTrack(episode);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-12">
      <VinylDisc cover={episode.cover} isPlaying={playing} />
      <div className="flex-1 text-center sm:text-left">
        <p className="text-sm text-muted-foreground">{episode.series}</p>
        <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">
          {episode.title}
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          {episode.description}
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
          <span>{formatDuration(episode.duration)}</span>
          <span>{formatPlayCount(episode.playCount)} 次播放</span>
        </div>
        <Button size="lg" className="mt-6 rounded-full px-8" onClick={handlePlay}>
          {playing ? (
            <>
              <Pause className="mr-2 h-5 w-5" />
              暂停播放
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              开始播放
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
