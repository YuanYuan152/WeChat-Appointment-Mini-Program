"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Pause, X } from "lucide-react";
import { useAudioPlayer } from "@/lib/stores/audio-player";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AudioPlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    togglePlay,
    setPlaying,
    setProgress,
    setDuration,
    clear,
  } = useAudioPlayer();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = currentTrack.audioUrl;
    if (isPlaying) {
      audio.play().catch(() => setPlaying(false));
    }
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 shadow-lg backdrop-blur-lg">
        <div
          className="absolute left-0 top-0 h-0.5 bg-primary transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href={`/audio/${currentTrack.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={currentTrack.cover} alt="" fill className="object-cover" sizes="48px" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentTrack.title}</p>
              <p className="truncate text-xs text-muted-foreground">{currentTrack.series}</p>
            </div>
          </Link>

          <Button variant="ghost" size="icon" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <span className="hidden text-xs text-muted-foreground sm:block">
            {formatDuration(progress)} / {formatDuration(duration || currentTrack.duration)}
          </span>

          <Button variant="ghost" size="icon" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
