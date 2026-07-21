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

export class HttpAdapter implements DataAdapter {
  private baseUrl: string;

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "") {
    this.baseUrl = baseUrl;
  }

  private notImplemented(): never {
    throw new Error(
      "HTTP adapter not implemented yet. Set NEXT_PUBLIC_DATA_SOURCE=mock or implement API endpoints."
    );
  }

  async getStories(): Promise<Story[]> {
    return this.notImplemented();
  }

  async getStoryBySlug(_slug: string): Promise<Story | null> {
    return this.notImplemented();
  }

  async getAudioEpisodes(): Promise<AudioEpisode[]> {
    return this.notImplemented();
  }

  async getAudioEpisodeById(_id: string): Promise<AudioEpisode | null> {
    return this.notImplemented();
  }

  async getConsultants(): Promise<Consultant[]> {
    return this.notImplemented();
  }

  async getConsultantById(_id: string): Promise<Consultant | null> {
    return this.notImplemented();
  }

  async getProfessionalAssessments(): Promise<Assessment[]> {
    return this.notImplemented();
  }

  async getFunAssessments(): Promise<Assessment[]> {
    return this.notImplemented();
  }

  async getAssessmentById(
    _id: string,
    _type: "professional" | "fun"
  ): Promise<Assessment | null> {
    return this.notImplemented();
  }

  async createBooking(_data: BookingPayload): Promise<BookingResult> {
    return this.notImplemented();
  }

  async getQaItems(): Promise<QaItem[]> {
    return this.notImplemented();
  }

  async getQaBySlug(_slug: string): Promise<QaItem | null> {
    return this.notImplemented();
  }

  async getOurStories(_type?: "visitor" | "trainee" | "counselor"): Promise<OurStory[]> {
    return this.notImplemented();
  }

  async getOurStoryBySlug(_slug: string): Promise<OurStory | null> {
    return this.notImplemented();
  }
}
