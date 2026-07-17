export interface StoryChapter {
  title: string;
  content: string;
  image?: string;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  cover: string;
  tags: string[];
  readMinutes: number;
  excerpt: string;
  chapters: StoryChapter[];
}

export interface AudioEpisode {
  id: string;
  title: string;
  series: string;
  seriesId: string;
  cover: string;
  description: string;
  duration: number;
  playCount: number;
  audioUrl: string;
  publishedAt: string;
}

export interface Consultant {
  id: string;
  name: string;
  title: string;
  avatar: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  experience: number;
  price: number;
  bio: string;
  qualifications: string[];
  availableSlots: string[];
}

export interface AssessmentOption {
  id: string;
  text: string;
  value: number;
  matchTags?: Record<string, number>;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  options: AssessmentOption[];
}

export interface ScoreRange {
  min: number;
  max: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface MatchResult {
  id: string;
  title: string;
  description: string;
  image: string;
  shareText: string;
}

export interface DimensionDefinition {
  id: string;
  title: string;
  questionIds: string[];
  reverseQuestionIds?: string[];
  aggregate?: "sum" | "average";
  intro?: string;
  scoreRanges: ScoreRange[];
}

export type AssessmentScoringType =
  | "sum"
  | "dimension"
  | "match"
  | "aas"
  | "psqi"
  | "pbi"
  | "cbcl"
  | "dark-light";

export interface Assessment {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  questionCount: number;
  duration: number;
  scoringType: AssessmentScoringType;
  questions: AssessmentQuestion[];
  scoreRanges?: ScoreRange[];
  matchResults?: MatchResult[];
  dimensions?: DimensionDefinition[];
  reverseQuestionIds?: string[];
  reportIntro?: string;
  disclaimer: string;
}

export interface BookingPayload {
  consultantId: string;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  note?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  message: string;
}

export interface SumScoreResult {
  type: "sum";
  totalScore: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface MatchScoreResult {
  type: "match";
  resultId: string;
  title: string;
  description: string;
  image: string;
  shareText: string;
}

export interface DimensionScoreItem {
  id: string;
  title: string;
  score: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface DimensionScoreResult {
  type: "dimension";
  dimensions: DimensionScoreItem[];
  summary?: string;
}

export type AssessmentScoreResult =
  | SumScoreResult
  | MatchScoreResult
  | DimensionScoreResult;

export interface AssessmentReportRecord {
  id: string;
  userId: number;
  assessmentId: string;
  type: "professional" | "fun";
  assessmentTitle: string;
  assessmentSubtitle: string;
  cover: string;
  disclaimer: string;
  scoringType: AssessmentScoringType;
  completedAt: string;
  resultSummary: string;
  result: AssessmentScoreResult;
}

export interface QaItem {
  id: string;
  slug: string;
  question: string;
  category: string;
  tags: string[];
  askerAlias: string;
  counselorName: string;
  counselorTitle: string;
  counselorAvatar: string;
  answer: string;
  excerpt: string;
  publishedAt: string;
  helpfulCount: number;
}

export interface OurStorySection {
  title: string;
  content: string;
  image?: string;
}

export interface OurStory {
  id: string;
  slug: string;
  type: "visitor" | "trainee" | "counselor";
  title: string;
  subtitle: string;
  cover: string;
  tags: string[];
  excerpt: string;
  author: string;
  readMinutes: number;
  publishedAt: string;
  highlights: string[];
  sections: OurStorySection[];
}

export interface DataAdapter {
  getStories(): Promise<Story[]>;
  getStoryBySlug(slug: string): Promise<Story | null>;
  getAudioEpisodes(): Promise<AudioEpisode[]>;
  getAudioEpisodeById(id: string): Promise<AudioEpisode | null>;
  getConsultants(): Promise<Consultant[]>;
  getConsultantById(id: string): Promise<Consultant | null>;
  getProfessionalAssessments(): Promise<Assessment[]>;
  getFunAssessments(): Promise<Assessment[]>;
  getAssessmentById(id: string, type: "professional" | "fun"): Promise<Assessment | null>;
  getQaItems(): Promise<QaItem[]>;
  getQaBySlug(slug: string): Promise<QaItem | null>;
  getOurStories(type?: "visitor" | "trainee" | "counselor"): Promise<OurStory[]>;
  getOurStoryBySlug(slug: string): Promise<OurStory | null>;
  createBooking(data: BookingPayload): Promise<BookingResult>;
}
