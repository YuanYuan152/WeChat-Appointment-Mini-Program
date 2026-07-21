"use client";

import { create } from "zustand";
import type { AudioEpisode } from "@/lib/api/types";

interface AudioPlayerState {
  currentTrack: AudioEpisode | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  setTrack: (track: AudioEpisode) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  clear: () => void;
}

export const useAudioPlayer = create<AudioPlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 0,

  setTrack: (track) => {
    const current = get().currentTrack;
    if (current?.id === track.id) {
      set({ isPlaying: !get().isPlaying });
    } else {
      set({ currentTrack: track, isPlaying: true, progress: 0, duration: track.duration });
    }
  },

  togglePlay: () => set({ isPlaying: !get().isPlaying }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setProgress: (progress) => set({ progress }),

  setDuration: (duration) => set({ duration }),

  clear: () =>
    set({ currentTrack: null, isPlaying: false, progress: 0, duration: 0 }),
}));
