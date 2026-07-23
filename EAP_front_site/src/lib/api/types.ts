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
  helpText?: string;
  required?: boolean;
  options: AssessmentOption[];
}

export type DemographicValue = string | number | boolean;

export interface DemographicOption {
  id: string;
  text: string;
  value: DemographicValue;
}

export interface DemographicValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface DemographicQuestion {
  id: string;
  text: string;
  helpText?: string;
  inputType: "single" | "multiple" | "text" | "number" | "date";
  required: boolean;
  options?: DemographicOption[];
  validation?: DemographicValidation;
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

export interface AssessmentReportProfile {
  id: string;
  title: string;
  description: string;
  suggestions: string[];
  image?: string;
  shareText?: string;
}

export interface AssessmentSummary {
  id: string;
  version: number;
  category: "professional" | "fun";
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  questionCount: number;
  duration: number;
  scoringType: AssessmentScoringType;
  sortOrder?: number;
}

export interface Assessment {
  schemaVersion?: 1;
  id: string;
  version?: number;
  status?: "draft" | "published" | "archived";
  category?: "professional" | "fun";
  title: string;
  subtitle: string;
  description: string;
  /** 答题前指导语（来自量表文档） */
  instructions?: string;
  /** 测评功能说明（来自量表文档「功能」等章节） */
  features?: string;
  cover: string;
  questionCount: number;
  duration: number;
  scoringType: AssessmentScoringType;
  scoringPreset?: string;
  sortOrder?: number;
  demographicQuestions?: DemographicQuestion[];
  questions: AssessmentQuestion[];
  scoreRanges?: ScoreRange[];
  matchResults?: MatchResult[];
  dimensions?: DimensionDefinition[];
  reverseQuestionIds?: string[];
  /** 报告页引导/功能说明 */
  reportIntro?: string;
  /** 固定计分模板的可编辑报告文案 */
  reportProfiles?: AssessmentReportProfile[];
  disclaimer: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
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

export interface AssessmentReportListItem {
  publicId: string;
  assessmentId: string;
  assessmentVersion: number;
  category: "professional" | "fun";
  assessmentTitle: string;
  assessmentSubtitle: string;
  cover: string;
  scoringType: AssessmentScoringType;
  completedAt: string;
  resultSummary: string;
}

export type AssessmentSnapshot = Omit<Assessment, "questionCount"> & {
  questionCount?: number;
};

export interface AssessmentReportSnapshot {
  schemaVersion: 1;
  assessment: AssessmentSnapshot;
  result: AssessmentScoreResult;
  reportContent: {
    title: string;
    subtitle: string;
    cover: string;
    disclaimer: string;
    reportIntro: string;
    features: string;
  };
  completedAt: string;
}

export interface AssessmentReportDetail extends AssessmentReportListItem {
  result: AssessmentScoreResult;
  reportSnapshot: AssessmentReportSnapshot;
  demographicAnswers?: Record<string, unknown>;
  answers?: Record<string, string>;
}

export interface AssessmentReportPage {
  items: AssessmentReportListItem[];
  page: number;
  pageSize: number;
  total: number;
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
