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
  chapterIds: string[];
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
  ownerId?: string;
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
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;

export interface DeleteBookInput {
  bookId: string;
}

export interface DeleteBookResult {
  deleted: boolean;
  bookId: string;
  chapterCount: number;
  chunkCount: number;
}

export interface UpdateBookMetadataInput {
  bookId: string;
  metadata: PrismaTypes.InputJsonValue;
}

export interface UpdateBookMetadataResult {
  updated: boolean;
  bookId: string;
  metadata: PrismaTypes.JsonValue | null;
}

export interface BookRepository {
  createBookWithContent(
    input: CreateBookWithContentInput,
  ): Promise<CreateBookWithContentResult>;

  getBookReaderData(bookId: string): Promise<BookReaderData | null>;

  listBooks(input?: ListBooksInput): Promise<BookListItem[]>;

  deleteBook(input: DeleteBookInput): Promise<DeleteBookResult>;

  updateBookMetadata(
    input: UpdateBookMetadataInput,
  ): Promise<UpdateBookMetadataResult>;
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

/**
 * Data-access interface for the ReadingProgress domain.
 *
 * Scope: pure DB read/write. No authorization, audit logging,
 * idempotency keys, conflict detection, or server-action logic.
 *
 * Architecture constraint (A276 / A277):
 * - Future real Reader sync must call this repository through a server
 *   action or service layer that enforces authentication, resource
 *   authorization, payload validation, idempotency, and conflict resolution.
 * - The Reader-side localStorage preview modules (reader-sync-*.ts)
 *   must not call this repository directly; they remain preview-only
 *   until a real sync path is authorized and implemented.
 *
 * Sync-contract alignment:
 * The four methods below cover every CRUD need described in the
 * reader-sync-contract-design.md minimum payload. Design-stage gaps
 * (explicit idempotency-key column, audit-log table / methods, monotonic
 * progressRatio conflict detection, lastReadAt field) are tracked in
 * docs/reader-sync-repository-alignment-audit.md and are not yet
 * implemented.
 */
export interface ReadingProgressRepository {
  /**
   * Upsert a single ReadingProgress row keyed on userId_bookId_chapterId.
   *
   * @param input - userId, bookId, chapterId (all required, trimmed,
   *   non-empty strings); progressRatio (required, clamped to [0, 1]);
   *   lastChunkId (optional, nullable).
   * @returns The upserted ReadingProgressRecord.
   *
   * Sync-contract mapping: corresponds to the "upsert with composite
   * unique key" requirement in the Reader sync contract draft.
   *
   * Current coverage: basic last-write-wins upsert with input
   * normalization. completedAt is auto-set when progressRatio >= 1.
   *
   * Not covered (design-stage): idempotency-key deduplication,
   * monotonic-progress conflict detection, audit-log emission.
   */
  upsertReadingProgress(
    input: UpsertReadingProgressInput,
  ): Promise<ReadingProgressRecord>;

  /**
   * Look up a single ReadingProgress row by its composite natural key.
   *
   * @param input - userId, bookId, chapterId (all required,
   *   trimmed, non-empty strings).
   * @returns The matching ReadingProgressRecord, or null if
   *   no row exists for that key.
   *
   * Sync-contract mapping: equivalent to the
   * getReadingProgressByUserAndChapter query in the Reader sync
   * contract draft (functional equivalence, different name; kept as-is
   * for consistency with the project's other repository methods).
   *
   * Not covered (design-stage): authorization checks, read-before-write
   * for conflict detection, idempotency-key lookup.
   */
  getReadingProgress(
    input: GetReadingProgressInput,
  ): Promise<ReadingProgressRecord | null>;

  /**
   * List ReadingProgress rows for a user, optionally filtered by book.
   *
   * @param input - userId (required, trimmed, non-empty string);
   *   bookId (optional filter, trimmed, non-empty when supplied);
   *   limit (optional, defaults to 50, capped at 200).
   * @returns An array of ReadingProgressRecord sorted by
   *   updatedAt DESC, id ASC.
   *
   * Sync-contract mapping: provides the "list by user" query
   * described in the sync contract draft.
   *
   * Not covered (design-stage): pagination cursors, authorization
   * scoping beyond the caller-supplied userId.
   */
  listReadingProgress(
    input: ListReadingProgressInput,
  ): Promise<ReadingProgressRecord[]>;

  /**
   * Mark a chapter as completed (progressRatio = 1) for the given
   * user/book/chapter combination.
   *
   * Delegates to upsertReadingProgress internally; no
   * separate write path.
   *
   * @param input - userId, bookId, chapterId (all required,
   *   trimmed, non-empty strings); lastChunkId (optional, nullable).
   * @returns The upserted ReadingProgressRecord with
   *   progressRatio === 1 and completedAt set.
   *
   * Sync-contract mapping: satisfies the "mark chapter complete"
   * operation in the Reader sync contract draft.
   *
   * Not covered (design-stage): completion-date backfill
   * validation, audit-log emission on completion events.
   */
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

// ---------------------------------------------------------------------------
// BookFavorite (dev-only DB favorites — A385)
// ---------------------------------------------------------------------------

export interface BookFavoriteRecord {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  sourceType: string;
  firstChapterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddFavoriteBookInput {
  userId: string;
  bookId: string;
  bookTitle: string;
  sourceType: string;
  firstChapterId?: string | null;
}

export interface RemoveFavoriteBookInput {
  userId: string;
  bookId: string;
}

export interface ListFavoritesByOwnerInput {
  userId: string;
  limit?: number;
}

export interface IsFavoriteBookInput {
  userId: string;
  bookId: string;
}

export interface FavoriteRepository {
  addFavoriteBook(input: AddFavoriteBookInput): Promise<BookFavoriteRecord>;

  removeFavoriteBook(input: RemoveFavoriteBookInput): Promise<boolean>;

  listFavoritesByOwner(
    input: ListFavoritesByOwnerInput,
  ): Promise<BookFavoriteRecord[]>;

  isFavoriteBook(input: IsFavoriteBookInput): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// ProblemFavorite (dev-only DB problem favorites — A387)
// ---------------------------------------------------------------------------

export interface ProblemFavoriteRecord {
  id: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AddProblemFavoriteInput {
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags?: string[];
}

export interface RemoveProblemFavoriteInput {
  userId: string;
  problemId: string;
}

export interface ListProblemFavoritesByOwnerInput {
  userId: string;
  limit?: number;
}

export interface IsProblemFavoriteInput {
  userId: string;
  problemId: string;
}

export interface ProblemFavoriteRepository {
  addFavoriteProblem(input: AddProblemFavoriteInput): Promise<ProblemFavoriteRecord>;
  removeFavoriteProblem(input: RemoveProblemFavoriteInput): Promise<boolean>;
  listFavoritesByOwner(input: ListProblemFavoritesByOwnerInput): Promise<ProblemFavoriteRecord[]>;
  isFavoriteProblem(input: IsProblemFavoriteInput): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// ProblemPracticeActivity (dev-only DB practice records — A387)
// ---------------------------------------------------------------------------

export type ProblemPracticeStatus = "not-started" | "practiced" | "completed" | "needs-review";

export interface ProblemPracticeActivityRecord {
  id: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: ProblemPracticeStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordProblemPracticeInput {
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: ProblemPracticeStatus;
  tags?: string[];
}

export interface ListProblemPracticeByOwnerInput {
  userId: string;
  limit?: number;
}

export interface ProblemPracticeRepository {
  recordPractice(input: RecordProblemPracticeInput): Promise<ProblemPracticeActivityRecord>;
  listPracticeByOwner(input: ListProblemPracticeByOwnerInput): Promise<ProblemPracticeActivityRecord[]>;
  getProblemPracticeStatus(input: GetProblemPracticeStatusInput): Promise<ProblemPracticeActivityRecord | null>;
  removeProblemPractice(input: RemoveProblemPracticeInput): Promise<boolean>;
}

export interface GetProblemPracticeStatusInput {
  userId: string;
  problemId: string;
}

export interface RemoveProblemPracticeInput {
  userId: string;
  problemId: string;
}

// ---------------------------------------------------------------------------
// LearningActivity (dev-only DB activity timeline — A392)
// ---------------------------------------------------------------------------

export type LearningActivityType =
  | "read-book"
  | "practice-problem"
  | "favorite-book"
  | "favorite-problem"
  | "add-note"
  | "add-bookmark"
  | "import-book"
  | "daily_challenge_completed";

export type LearningActivityTargetType =
  | "book"
  | "chapter"
  | "problem"
  | "note"
  | "bookmark";

export const VALID_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "read-book",
  "practice-problem",
  "favorite-book",
  "favorite-problem",
  "add-note",
  "add-bookmark",
  "import-book",
  "daily_challenge_completed",
]);

export const VALID_TARGET_TYPES: ReadonlySet<string> = new Set([
  "book",
  "chapter",
  "problem",
  "note",
  "bookmark",
]);

export interface LearningActivityRecord {
  id: string;
  userId: string;
  activityType: LearningActivityType;
  title: string;
  targetType: LearningActivityTargetType;
  targetId: string;
  bookId: string | null;
  chapterId: string | null;
  problemId: string | null;
  sourceType: string;
  occurredAt: Date;
  durationSeconds: number | null;
  metadataPreview: string | null;
  createdAt: Date;
}

export interface RecordLearningActivityInput {
  userId: string;
  activityType: LearningActivityType;
  title: string;
  targetType: LearningActivityTargetType;
  targetId: string;
  bookId?: string | null;
  chapterId?: string | null;
  problemId?: string | null;
  sourceType: string;
  occurredAt: Date;
  durationSeconds?: number | null;
  metadataPreview?: string | null;
}

export interface ListLearningActivitiesByOwnerInput {
  userId: string;
  limit?: number;
  activityType?: LearningActivityType;
}

export interface LearningActivityRepository {
  recordLearningActivity(input: RecordLearningActivityInput): Promise<LearningActivityRecord>;
  listLearningActivitiesByOwner(input: ListLearningActivitiesByOwnerInput): Promise<LearningActivityRecord[]>;
}

// ---------------------------------------------------------------------------
// ReadingSession (dev-only DB reading sessions — A392)
// ---------------------------------------------------------------------------

export interface ReadingSessionRecord {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  progressRatio: number;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartReadingSessionInput {
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  startedAt: Date;
  durationSeconds: number;
  progressRatio: number;
  sourceType: string;
}

export interface EndReadingSessionInput {
  userId: string;
  sessionId: string;
  endedAt: Date;
  durationSeconds: number;
}

export interface ListReadingSessionsByOwnerInput {
  userId: string;
  limit?: number;
}

export interface ReadingSessionSummary {
  totalSessions: number;
  totalDurationSeconds: number;
  totalDurationMinutes: number;
}

export interface ReadingSessionRepository {
  startReadingSession(input: StartReadingSessionInput): Promise<ReadingSessionRecord>;
  endReadingSession(input: EndReadingSessionInput): Promise<ReadingSessionRecord>;
  listReadingSessionsByOwner(input: ListReadingSessionsByOwnerInput): Promise<ReadingSessionRecord[]>;
  summarizeReadingSessionsByOwner(userId: string): Promise<ReadingSessionSummary>;
}

export interface ReaderBookmarkRecord {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddReaderBookmarkInput {
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
}

export interface RemoveReaderBookmarkInput {
  userId: string;
  bookId: string;
  chapterId: string;
}

export interface ListReaderBookmarksByOwnerInput {
  userId: string;
  limit?: number;
}

export interface IsReaderBookmarkedInput {
  userId: string;
  bookId: string;
  chapterId: string;
}

export interface ReaderBookmarkRepository {
  addReaderBookmark(input: AddReaderBookmarkInput): Promise<ReaderBookmarkRecord>;
  removeReaderBookmark(input: RemoveReaderBookmarkInput): Promise<boolean>;
  listReaderBookmarksByOwner(input: ListReaderBookmarksByOwnerInput): Promise<ReaderBookmarkRecord[]>;
  isReaderBookmarked(input: IsReaderBookmarkedInput): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// ReaderNote (dev-only DB reader notes — A390)
// ---------------------------------------------------------------------------

export interface ReaderNoteRecord {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  excerptPreview: string | null;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddReaderNoteInput {
  userId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  excerptPreview?: string | null;
  sourceType: string;
}

export interface UpdateReaderNoteInput {
  userId: string;
  noteId: string;
  noteText: string;
  excerptPreview?: string | null;
  progressRatio?: number;
}

export interface RemoveReaderNoteInput {
  userId: string;
  noteId: string;
}

export interface ListReaderNotesByOwnerInput {
  userId: string;
  limit?: number;
}

export interface ListReaderNotesByBookChapterInput {
  userId: string;
  bookId: string;
  chapterId: string;
  limit?: number;
}

export interface ReaderNoteRepository {
  addReaderNote(input: AddReaderNoteInput): Promise<ReaderNoteRecord>;
  updateReaderNote(input: UpdateReaderNoteInput): Promise<ReaderNoteRecord>;
  removeReaderNote(input: RemoveReaderNoteInput): Promise<boolean>;
  listReaderNotesByOwner(input: ListReaderNotesByOwnerInput): Promise<ReaderNoteRecord[]>;
  listReaderNotesByBookChapter(input: ListReaderNotesByBookChapterInput): Promise<ReaderNoteRecord[]>;
}

// ---------------------------------------------------------------------------
// ProblemWrongBook (dev-only DB wrong book — A395)
// ---------------------------------------------------------------------------

export type ProblemWrongBookReviewStatus =
  | "needs-review"
  | "reviewed"
  | "mastered";

export const VALID_WRONG_BOOK_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "needs-review",
  "reviewed",
  "mastered",
]);

export interface ProblemWrongBookRecord {
  id: string;
  ownerId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tagsJson: string;
  wrongCount: number;
  lastWrongAt: Date;
  reviewStatus: ProblemWrongBookReviewStatus;
  notePreview: string | null;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddProblemWrongBookInput {
  ownerId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags?: string[];
  sourceType?: string;
}

export interface RecordProblemWrongInput {
  ownerId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags?: string[];
  sourceType?: string;
}

export interface RemoveProblemWrongBookInput {
  ownerId: string;
  problemId: string;
}

export interface UpdateProblemWrongBookReviewStatusInput {
  ownerId: string;
  problemId: string;
  reviewStatus: ProblemWrongBookReviewStatus;
}

export interface UpdateProblemWrongBookNoteInput {
  ownerId: string;
  problemId: string;
  notePreview: string | null;
}

export interface ListProblemWrongBookByOwnerInput {
  ownerId: string;
  limit?: number;
}

export interface IsProblemInWrongBookInput {
  ownerId: string;
  problemId: string;
}

export interface ProblemWrongBookRepository {
  addProblemToWrongBook(input: AddProblemWrongBookInput): Promise<ProblemWrongBookRecord>;
  recordProblemWrong(input: RecordProblemWrongInput): Promise<ProblemWrongBookRecord>;
  removeProblemFromWrongBook(input: RemoveProblemWrongBookInput): Promise<boolean>;
  updateProblemWrongBookReviewStatus(input: UpdateProblemWrongBookReviewStatusInput): Promise<ProblemWrongBookRecord>;
  updateProblemWrongBookNote(input: UpdateProblemWrongBookNoteInput): Promise<ProblemWrongBookRecord>;
  listProblemWrongBookByOwner(input: ListProblemWrongBookByOwnerInput): Promise<ProblemWrongBookRecord[]>;
  isProblemInWrongBook(input: IsProblemInWrongBookInput): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// DailyChallengeProgress (guarded preview persistence)
// ---------------------------------------------------------------------------

export type DailyChallengeProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "needs-review";

export interface DailyChallengeProgressRecord {
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: DailyChallengeProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendationSource: string;
  recommendationReason: string;
}

export interface DailyChallengeProgressUpsertInput {
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: DailyChallengeProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendationSource: string;
  recommendationReason: string;
}

export interface DailyChallengeProgressSafetyMetadata {
  productionReady: false;
  llmUsed: false;
  externalApiUsed: false;
  safeToExposeToClient: true;
  writesDatabase: boolean;
  guardActive: boolean;
  status: "blocked" | "preview";
  blockedReasons: string[];
}

export interface DailyChallengeProgressFindResult {
  record: DailyChallengeProgressRecord | null;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressUpsertResult {
  record: DailyChallengeProgressRecord | null;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressClearResult {
  success: boolean;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressRepository {
  findByDate(date: string): Promise<DailyChallengeProgressFindResult>;
  upsertProgress(input: DailyChallengeProgressUpsertInput): Promise<DailyChallengeProgressUpsertResult>;
  clearToday(date: string): Promise<DailyChallengeProgressClearResult>;
}

// ---------------------------------------------------------------------------
// Email OTP (email login/register mainline)
// ---------------------------------------------------------------------------

export type EmailOtpPurpose = "login" | "register";

export const VALID_EMAIL_OTP_PURPOSES: ReadonlySet<EmailOtpPurpose> = new Set([
  "login",
  "register",
]);

export interface CreateEmailOtpInput {
  email: string;
  codeHash: string;
  purpose: EmailOtpPurpose;
  expiresAt: Date;
}

export interface EmailOtpRecordSafe {
  id: string;
  email: string;
  purpose: EmailOtpPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailOtpRepository {
  createEmailOtp(input: CreateEmailOtpInput): Promise<EmailOtpRecordSafe>;
  findLatestActiveEmailOtp(email: string, purpose: EmailOtpPurpose): Promise<EmailOtpRecordSafe | null>;
  markEmailOtpConsumed(id: string): Promise<EmailOtpRecordSafe | null>;
  incrementEmailOtpAttempts(id: string): Promise<EmailOtpRecordSafe | null>;
  deleteExpiredEmailOtps(): Promise<number>;
  getEmailOtpById(id: string): Promise<EmailOtpRecordSafe | null>;
  getCodeHashForVerification(id: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Article favorites and recent readings
// ---------------------------------------------------------------------------

export interface ArticleFavoriteRecord {
  id: string;
  userId: string;
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleReadingRecord extends ArticleFavoriteRecord {
  lastReadAt: Date;
}

export interface AddFavoriteArticleInput {
  userId: string;
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
}

export interface RemoveFavoriteArticleInput {
  userId: string;
  articleId: string;
}

export interface IsFavoriteArticleInput {
  userId: string;
  articleId: string;
}

export interface ListFavoriteArticlesByOwnerInput {
  userId: string;
  limit?: number;
}

export interface RecordArticleReadingInput extends AddFavoriteArticleInput {
  lastReadAt?: Date;
}

export interface ListArticleReadingsByOwnerInput {
  userId: string;
  limit?: number;
}

export interface ArticleRepository {
  addFavoriteArticle(input: AddFavoriteArticleInput): Promise<ArticleFavoriteRecord>;
  removeFavoriteArticle(input: RemoveFavoriteArticleInput): Promise<boolean>;
  listFavoriteArticlesByOwner(input: ListFavoriteArticlesByOwnerInput): Promise<ArticleFavoriteRecord[]>;
  isFavoriteArticle(input: IsFavoriteArticleInput): Promise<boolean>;
  recordArticleReading(input: RecordArticleReadingInput): Promise<ArticleReadingRecord>;
  listArticleReadingsByOwner(input: ListArticleReadingsByOwnerInput): Promise<ArticleReadingRecord[]>;
}

// ---------------------------------------------------------------------------
// Assistant memory persistence
// ---------------------------------------------------------------------------

export type MemoryRecordCategory =
  | "preference"
  | "goal"
  | "learning"
  | "project"
  | "other";

export type MemoryRecordSource =
  | "assistant_suggested"
  | "user_created";

export interface MemoryRecord {
  id: string;
  userId: string;
  sessionId: string | null;
  sourceMessageId: string | null;
  memoryType: "PROFILE" | "SESSION_SUMMARY" | "RETRIEVABLE";
  content: string;
  category: MemoryRecordCategory;
  source: MemoryRecordSource;
  enabled: boolean;
  importance: number;
  metadata: PrismaTypes.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddMemoryInput {
  userId: string;
  content: string;
  category?: MemoryRecordCategory;
  source?: MemoryRecordSource;
  enabled?: boolean;
  importance?: number;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  metadata?: PrismaTypes.InputJsonValue | null;
}

export interface ToggleMemoryEnabledInput {
  userId: string;
  memoryId: string;
  enabled: boolean;
}

export interface DeleteMemoryInput {
  userId: string;
  memoryId: string;
}

export interface ListMemoriesByOwnerInput {
  userId: string;
  limit?: number;
  includeDisabled?: boolean;
}

export interface MemoryRepository {
  listMemoriesByOwner(input: ListMemoriesByOwnerInput): Promise<MemoryRecord[]>;
  addMemory(input: AddMemoryInput): Promise<MemoryRecord>;
  toggleMemoryEnabled(input: ToggleMemoryEnabledInput): Promise<MemoryRecord | null>;
  deleteMemory(input: DeleteMemoryInput): Promise<boolean>;
}
