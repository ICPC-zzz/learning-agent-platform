import type {
  Book,
  BookChapter,
  BookSourceType as PrismaBookSourceType,
  ContentChunk,
  DailyRecommendation,
  Prisma as PrismaTypes,
  Problem,
  ProblemDifficulty as PrismaProblemDifficulty,
  RecommendationStatus as PrismaRecommendationStatus,
  ReadingProgress,
  User,
  UserAbilityProfile,
} from "@prisma/client";

export { Prisma } from "@prisma/client";
export type { PrismaClient } from "@prisma/client";

export type DbPackageStatus = "client-boundary";

export type DatabaseProvider = "postgresql";

export type BookSourceType = PrismaBookSourceType;

export type ProblemDifficulty = PrismaProblemDifficulty;

export type RecommendationStatus = PrismaRecommendationStatus;

export type BookRecord = Book;

export type BookChapterRecord = BookChapter;

export type ContentChunkRecord = ContentChunk;

export type UserRecord = Pick<
  User,
  | "id"
  | "authProvider"
  | "authProviderId"
  | "email"
  | "name"
  | "createdAt"
  | "updatedAt"
>;

export type ReadingProgressRecord = Pick<
  ReadingProgress,
  | "id"
  | "userId"
  | "bookId"
  | "chapterId"
  | "lastChunkId"
  | "progressRatio"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
>;

export type ChapterQaHistoryAnswerSource =
  | "mock"
  | "real_openai"
  | "fallback_mock";

export type ChapterQaHistoryProviderMode =
  | "mock"
  | "real"
  | "openai"
  | "anthropic"
  | "local";

export type ChapterQaHistoryProviderErrorCategory =
  | "timeout"
  | "network_error"
  | "provider_http_error"
  | "invalid_provider_response"
  | "empty_answer"
  | "provider_unavailable"
  | "unknown_provider_error";

export type ChapterQaHistoryFallbackReason =
  ChapterQaHistoryProviderErrorCategory;

export interface ChapterQaHistoryAnswerMetadataInput {
  answerSource: ChapterQaHistoryAnswerSource;
  providerId: string;
  providerLabel: string;
  requestedProviderMode: string;
  resolvedProviderMode: ChapterQaHistoryProviderMode;
  modelConfigured: boolean;
  networkUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason?: ChapterQaHistoryFallbackReason | null;
  errorCategory?: ChapterQaHistoryProviderErrorCategory | null;
  contextSummary?: PrismaTypes.InputJsonValue | null;
  contextChunkRange?: PrismaTypes.InputJsonValue | null;
}

export interface CreateChapterQaHistoryRecordInput {
  userId: string;
  bookId: string;
  chapterId: string;
  question: string;
  answer: string;
  metadata: ChapterQaHistoryAnswerMetadataInput;
}

export interface ListChapterQaHistoryRecordsInput {
  userId: string;
  bookId?: string;
  chapterId?: string;
  limit?: number;
}

export interface GetChapterQaHistoryRecordByIdInput {
  id: string;
  userId?: string;
}

export interface ChapterQaHistoryRecord {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  question: string;
  answer: string;
  answerSource: ChapterQaHistoryAnswerSource;
  providerId: string;
  providerLabel: string;
  requestedProviderMode: string;
  resolvedProviderMode: string;
  modelConfigured: boolean;
  networkUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  errorCategory: string | null;
  contextSummary: PrismaTypes.JsonValue | null;
  contextChunkRange: PrismaTypes.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterQaHistoryRepository {
  createQuestionAnswerRecord(
    input: CreateChapterQaHistoryRecordInput,
  ): Promise<ChapterQaHistoryRecord>;

  listQuestionAnswerRecordsForUser(
    input: ListChapterQaHistoryRecordsInput,
  ): Promise<ChapterQaHistoryRecord[]>;

  getQuestionAnswerRecordById(
    input: GetChapterQaHistoryRecordByIdInput,
  ): Promise<ChapterQaHistoryRecord | null>;
}

export type ChapterQaFeedbackRating = "helpful" | "unhelpful" | "neutral";

export interface UpsertChapterQaFeedbackInput {
  userId: string;
  historyRecordId: string;
  rating: ChapterQaFeedbackRating;
  note?: string | null;
}

export interface GetChapterQaFeedbackInput {
  userId: string;
  historyRecordId: string;
}

export type ClearChapterQaFeedbackInput = GetChapterQaFeedbackInput;

export interface ChapterQaFeedbackRecord {
  historyRecordId: string;
  userId: string;
  rating: ChapterQaFeedbackRating;
  note: string | null;
  feedbackAt: Date;
  updatedAt: Date;
}

export interface ChapterQaFeedbackRepository {
  upsertQuestionAnswerFeedback(
    input: UpsertChapterQaFeedbackInput,
  ): Promise<ChapterQaFeedbackRecord>;

  getQuestionAnswerFeedback(
    input: GetChapterQaFeedbackInput,
  ): Promise<ChapterQaFeedbackRecord | null>;

  clearQuestionAnswerFeedback(
    input: ClearChapterQaFeedbackInput,
  ): Promise<boolean>;
}

export type AbilityProfileRecord = UserAbilityProfile;

export type ProblemRecord = Problem;

export type DailyRecommendationRecord = DailyRecommendation & {
  problem: ProblemRecord;
};

export interface CreateBookChapterInput {
  id?: string;
  parentId?: string | null;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}

export interface CreateContentChunkInput {
  id?: string;
  chapterId?: string;
  chapterOrderIndex?: number;
  orderIndex: number;
  plainText: string;
  charCount?: number;
  startOffset?: number | null;
  endOffset?: number | null;
}

export interface CreateBookWithContentInput {
  title: string;
  author?: string | null;
  sourceType: BookSourceType;
  sourceMetadata?: PrismaTypes.InputJsonValue;
  chapters: CreateBookChapterInput[];
  chunks: CreateContentChunkInput[];
}

export interface CreateBookWithContentResult {
  bookId: string;
  chapterCount: number;
  chunkCount: number;
}

export interface BookReaderData {
  book: BookRecord;
  chapters: BookChapterRecord[];
  chunks: ContentChunkRecord[];
}

export interface ListBooksInput {
  limit?: number;
  sourceType?: BookSourceType;
}

export type BookListItem = Pick<
  BookRecord,
  | "id"
  | "sourceType"
  | "title"
  | "subtitle"
  | "author"
  | "description"
  | "sourceUrl"
  | "language"
  | "tags"
  | "createdAt"
  | "updatedAt"
>;

export interface BookRepository {
  createBookWithContent(
    input: CreateBookWithContentInput,
  ): Promise<CreateBookWithContentResult>;

  getBookReaderData(bookId: string): Promise<BookReaderData | null>;

  listBooks(input?: ListBooksInput): Promise<BookListItem[]>;
}

export interface CreateUserInput {
  email?: string | null;
  name?: string | null;
  authProvider?: string | null;
  authProviderId?: string | null;
}

export interface UpdateUserInput {
  email?: string | null;
  name?: string | null;
}

export interface FindUserInput {
  id?: string;
  email?: string;
  authProvider?: string;
  authProviderId?: string;
}

export interface UserRepository {
  createUser(input: CreateUserInput): Promise<UserRecord>;

  getUserById(userId: string): Promise<UserRecord | null>;

  getUserByEmail(email: string): Promise<UserRecord | null>;

  updateUser(userId: string, input: UpdateUserInput): Promise<UserRecord>;

  findOrCreateUser(input: CreateUserInput): Promise<UserRecord>;
}

export interface UpsertReadingProgressInput {
  userId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId?: string | null;
}

export interface GetReadingProgressInput {
  userId: string;
  bookId: string;
  chapterId: string;
}

export interface ListReadingProgressInput {
  userId: string;
  bookId?: string;
  limit?: number;
}

export interface MarkChapterCompletedInput {
  userId: string;
  bookId: string;
  chapterId: string;
  lastChunkId?: string | null;
}

export interface ReadingProgressRepository {
  upsertReadingProgress(
    input: UpsertReadingProgressInput,
  ): Promise<ReadingProgressRecord>;

  getReadingProgress(
    input: GetReadingProgressInput,
  ): Promise<ReadingProgressRecord | null>;

  listReadingProgress(
    input: ListReadingProgressInput,
  ): Promise<ReadingProgressRecord[]>;

  markChapterCompleted(
    input: MarkChapterCompletedInput,
  ): Promise<ReadingProgressRecord>;
}

export interface UpsertAbilityProfileInput {
  userId: string;
  overallScore: number;
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
  readingScore?: number;
  languageFundamentalsScore?: number;
  engineeringPracticeScore?: number;
  lastEvaluatedAt?: Date | null;
  confidence?: number;
  metadata?: PrismaTypes.InputJsonValue;
}

export interface CreateProblemInput {
  id?: string;
  title: string;
  description?: string | null;
  difficulty: ProblemDifficulty;
  tags: string[];
  source?: string | null;
  sourceUrl?: string | null;
  metadata?: PrismaTypes.InputJsonValue;
}

export interface ListProblemsInput {
  limit?: number;
  difficulty?: ProblemDifficulty;
  tags?: string[];
  source?: string | null;
}

export interface CreateDailyRecommendationItemInput {
  problemId: string;
  reason?: string | null;
  status?: RecommendationStatus;
  score?: number;
  metadata?: PrismaTypes.InputJsonValue;
}

export interface CreateDailyRecommendationsInput {
  userId: string;
  recommendationDate: Date;
  recommendations: CreateDailyRecommendationItemInput[];
}

export interface GetDailyRecommendationsInput {
  userId: string;
  recommendationDate: Date;
}

export interface LearningRepository {
  upsertAbilityProfile(
    input: UpsertAbilityProfileInput,
  ): Promise<AbilityProfileRecord>;

  getAbilityProfile(userId: string): Promise<AbilityProfileRecord | null>;

  createProblem(input: CreateProblemInput): Promise<ProblemRecord>;

  getProblemById(problemId: string): Promise<ProblemRecord | null>;

  listProblems(input?: ListProblemsInput): Promise<ProblemRecord[]>;

  createDailyRecommendations(
    input: CreateDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]>;

  upsertDailyRecommendations(
    input: CreateDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]>;

  getDailyRecommendations(
    input: GetDailyRecommendationsInput,
  ): Promise<DailyRecommendationRecord[]>;
}

export interface DatabaseEnvStatus {
  hasDatabaseUrl: boolean;
  provider: DatabaseProvider;
  isConfigured: boolean;
}
