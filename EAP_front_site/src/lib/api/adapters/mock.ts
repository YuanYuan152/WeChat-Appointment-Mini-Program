import storiesData from "@/data/stories.json";
import audioData from "@/data/audio-episodes.json";
import consultantsData from "@/data/consultants.json";
import professionalData from "@/data/assessments-professional.json";
import funData from "@/data/assessments-fun.json";
import qaData from "@/data/qa.json";
import ourStoriesData from "@/data/our-stories.json";
import type {
  Assessment,
  AudioEpisode,
  BookingPayload,
  BookingResult,
  Consultant,
  DataAdapter,
  OurStory,
  QaItem,
  Story,
} from "../types";
import { enrichAssessmentGuidance } from "@/lib/assessment/scale-guidance";

function withGuidance(list: Assessment[]): Assessment[] {
  return list.map((a) => enrichAssessmentGuidance(a) as Assessment);
}

export class MockAdapter implements DataAdapter {
  async getStories(): Promise<Story[]> {
    return storiesData as Story[];
  }

  async getStoryBySlug(slug: string): Promise<Story | null> {
    const stories = await this.getStories();
    return stories.find((s) => s.slug === slug) ?? null;
  }

  async getAudioEpisodes(): Promise<AudioEpisode[]> {
    return audioData as AudioEpisode[];
  }

  async getAudioEpisodeById(id: string): Promise<AudioEpisode | null> {
    const episodes = await this.getAudioEpisodes();
    return episodes.find((e) => e.id === id) ?? null;
  }

  async getConsultants(): Promise<Consultant[]> {
    return consultantsData as Consultant[];
  }

  async getConsultantById(id: string): Promise<Consultant | null> {
    const consultants = await this.getConsultants();
    return consultants.find((c) => c.id === id) ?? null;
  }

  async getProfessionalAssessments(): Promise<Assessment[]> {
    return withGuidance(professionalData as unknown as Assessment[]);
  }

  async getFunAssessments(): Promise<Assessment[]> {
    return withGuidance(funData as unknown as Assessment[]);
  }

  async getAssessmentById(
    id: string,
    type: "professional" | "fun"
  ): Promise<Assessment | null> {
    const assessments =
      type === "professional"
        ? await this.getProfessionalAssessments()
        : await this.getFunAssessments();
    return assessments.find((a) => a.id === id) ?? null;
  }

  async createBooking(data: BookingPayload): Promise<BookingResult> {
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      bookingId: `BK-${Date.now()}`,
      message: `预约成功！${data.name} 已预约 ${data.date} ${data.timeSlot} 的电话咨询，咨询师将在预约时间与您联系。`,
    };
  }

  async getQaItems(): Promise<QaItem[]> {
    return qaData as QaItem[];
  }

  async getQaBySlug(slug: string): Promise<QaItem | null> {
    const items = await this.getQaItems();
    return items.find((q) => q.slug === slug) ?? null;
  }

  async getOurStories(type?: "visitor" | "trainee" | "counselor"): Promise<OurStory[]> {
    const stories = ourStoriesData as OurStory[];
    if (!type) return stories;
    return stories.filter((s) => s.type === type);
  }

  async getOurStoryBySlug(slug: string): Promise<OurStory | null> {
    const stories = await this.getOurStories();
    return stories.find((s) => s.slug === slug) ?? null;
  }
}
