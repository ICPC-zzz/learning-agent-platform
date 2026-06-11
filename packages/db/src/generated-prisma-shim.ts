/**
 * Prisma Client typing shim for models not yet generated.
 *
 * The Prisma Client has NOT been regenerated after the following models
 * were added to schema.prisma:
 *   - BookFavorite (A385)
 *   - ProblemFavorite (A387)
 *   - ProblemPracticeActivity (A387)
 *   - ReaderBookmark (A390)
 *   - ReaderNote (A390)
 *   - LearningActivity (A392)
 *   - ReadingSession (A392)
 *
 * This file uses TypeScript module augmentation to add the missing model
 * delegates to `@prisma/client`'s `PrismaClient` interface so that
 * repository code typechecks without the generated client.
 *
 * **This is a development shim.**
 * After running `npx prisma generate`, the real generated types from
 * `.prisma/client/index.d.ts` will take over and this file becomes
 * redundant. You can remove it at that point.
 *
 * The types defined here match the Prisma schema definitions and the
 * exact method signatures used by the repositories. They are NOT a
 * complete representation of the Prisma delegate API — only the
 * methods actually called are typed.
 *
 * @module generated-prisma-shim
 * @devOnly — remove after `prisma generate`
 */

import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Delegate record shapes — match schema.prisma model definitions
// ---------------------------------------------------------------------------

interface BookFavoriteDelegateRecord {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  sourceType: string;
  firstChapterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProblemFavoriteDelegateRecord {
  id: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProblemPracticeActivityDelegateRecord {
  id: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// -- A390: ReaderBookmark / ReaderNote delegates --

interface ReaderBookmarkDelegateRecord {
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

interface ReaderNoteDelegateRecord {
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

// ---------------------------------------------------------------------------
// Delegate interfaces — only the methods actually called by repositories
// ---------------------------------------------------------------------------

interface BookFavoriteDelegate {
  upsert(args: {
    where: { userId_bookId: { userId: string; bookId: string } };
    create: {
      userId: string;
      bookId: string;
      bookTitle: string;
      sourceType: string;
      firstChapterId: string | null;
    };
    update: {
      bookTitle: string;
      sourceType: string;
      firstChapterId: string | null;
    };
  }): Promise<BookFavoriteDelegateRecord>;

  delete(args: {
    where: { userId_bookId: { userId: string; bookId: string } };
  }): Promise<BookFavoriteDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<BookFavoriteDelegateRecord[]>;

  count(args: {
    where: { userId: string; bookId: string };
  }): Promise<number>;
}

interface ProblemFavoriteDelegate {
  upsert(args: {
    where: { userId_problemId: { userId: string; problemId: string } };
    create: {
      userId: string;
      problemId: string;
      problemTitle: string;
      difficulty: string;
      tags: string[];
    };
    update: {
      problemTitle: string;
      difficulty: string;
      tags: string[];
    };
  }): Promise<ProblemFavoriteDelegateRecord>;

  delete(args: {
    where: { userId_problemId: { userId: string; problemId: string } };
  }): Promise<ProblemFavoriteDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ProblemFavoriteDelegateRecord[]>;

  count(args: {
    where: { userId: string; problemId: string };
  }): Promise<number>;
}

interface ProblemPracticeActivityDelegate {
  findFirst(args: {
    where: { userId: string; problemId: string };
  }): Promise<ProblemPracticeActivityDelegateRecord | null>;

  create(args: {
    data: {
      userId: string;
      problemId: string;
      problemTitle: string;
      difficulty: string;
      status: string;
      tags: string[];
    };
  }): Promise<ProblemPracticeActivityDelegateRecord>;

  update(args: {
    where: { id: string };
    data: {
      problemTitle: string;
      difficulty: string;
      status: string;
      tags: string[];
    };
  }): Promise<ProblemPracticeActivityDelegateRecord>;

  delete(args: {
    where: { id: string };
  }): Promise<ProblemPracticeActivityDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ProblemPracticeActivityDelegateRecord[]>;
}

// -- A392: LearningActivityDelegate / ReadingSessionDelegate --

interface LearningActivityDelegateRecord {
  id: string;
  userId: string;
  activityType: string;
  title: string;
  targetType: string;
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

interface ReadingSessionDelegateRecord {
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

interface LearningActivityDelegate {
  create(args: {
    data: {
      userId: string;
      activityType: string;
      title: string;
      targetType: string;
      targetId: string;
      bookId?: string | null;
      chapterId?: string | null;
      problemId?: string | null;
      sourceType: string;
      occurredAt: Date;
      durationSeconds?: number | null;
      metadataPreview?: string | null;
    };
  }): Promise<LearningActivityDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<LearningActivityDelegateRecord[]>;

  count(args: {
    where: { userId: string };
  }): Promise<number>;
}

interface ReadingSessionDelegate {
  create(args: {
    data: {
      userId: string;
      bookId: string;
      chapterId: string;
      bookTitle: string;
      chapterTitle: string;
      startedAt: Date;
      endedAt?: Date | null;
      durationSeconds: number;
      progressRatio: number;
      sourceType: string;
    };
  }): Promise<ReadingSessionDelegateRecord>;

  update(args: {
    where: { id: string };
    data: {
      endedAt?: Date | null;
      durationSeconds?: number;
      progressRatio?: number;
    };
  }): Promise<ReadingSessionDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ReadingSessionDelegateRecord[]>;

  count(args: {
    where: { userId: string };
  }): Promise<number>;

  findFirst(args: {
    where: { userId: string; id: string };
  }): Promise<ReadingSessionDelegateRecord | null>;
}

// -- A390: ReaderBookmarkDelegate / ReaderNoteDelegate --

interface ReaderBookmarkDelegate {
  upsert(args: {
    where: { userId_bookId_chapterId: { userId: string; bookId: string; chapterId: string } };
    create: {
      userId: string;
      bookId: string;
      chapterId: string;
      bookTitle: string;
      chapterTitle: string;
      progressRatio: number;
      sourceType: string;
    };
    update: {
      bookTitle: string;
      chapterTitle: string;
      progressRatio: number;
      sourceType: string;
    };
  }): Promise<ReaderBookmarkDelegateRecord>;

  delete(args: {
    where: { userId_bookId_chapterId: { userId: string; bookId: string; chapterId: string } };
  }): Promise<ReaderBookmarkDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ReaderBookmarkDelegateRecord[]>;

  count(args: {
    where: { userId: string; bookId: string; chapterId: string };
  }): Promise<number>;

  findFirst(args: {
    where: { userId: string; bookId: string; chapterId: string };
  }): Promise<ReaderBookmarkDelegateRecord | null>;
}

interface ReaderNoteDelegate {
  create(args: {
    data: {
      userId: string;
      bookId: string;
      chapterId: string;
      bookTitle: string;
      chapterTitle: string;
      progressRatio: number;
      noteText: string;
      excerptPreview: string | null;
      sourceType: string;
    };
  }): Promise<ReaderNoteDelegateRecord>;

  update(args: {
    where: { id: string };
    data: {
      noteText: string;
      excerptPreview: string | null;
      progressRatio: number;
    };
  }): Promise<ReaderNoteDelegateRecord>;

  delete(args: {
    where: { id: string };
  }): Promise<ReaderNoteDelegateRecord>;

  findMany(args: {
    where: { userId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ReaderNoteDelegateRecord[]>;
}

// -- A395: ProblemWrongBookDelegate --

interface ProblemWrongBookDelegateRecord {
  id: string;
  ownerId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tagsJson: string;
  wrongCount: number;
  lastWrongAt: Date;
  reviewStatus: string;
  notePreview: string | null;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProblemWrongBookDelegate {
  findFirst(args: {
    where: { ownerId: string; problemId: string };
  }): Promise<ProblemWrongBookDelegateRecord | null>;

  create(args: {
    data: {
      ownerId: string;
      problemId: string;
      problemTitle: string;
      difficulty: string;
      tagsJson: string;
      wrongCount: number;
      lastWrongAt: Date;
      reviewStatus: string;
      notePreview: string | null;
      sourceType: string;
    };
  }): Promise<ProblemWrongBookDelegateRecord>;

  update(args: {
    where: { id: string };
    data: {
      problemTitle?: string;
      difficulty?: string;
      tagsJson?: string;
      wrongCount?: number;
      lastWrongAt?: Date;
      reviewStatus?: string;
      notePreview?: string | null;
    };
  }): Promise<ProblemWrongBookDelegateRecord>;

  delete(args: {
    where: { id: string };
  }): Promise<ProblemWrongBookDelegateRecord>;

  findMany(args: {
    where: { ownerId: string };
    take: number;
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<ProblemWrongBookDelegateRecord[]>;

  count(args: {
    where: { ownerId: string; problemId?: string; reviewStatus?: string };
  }): Promise<number>;
}

// ---------------------------------------------------------------------------
// Module augmentation — merge missing delegates into PrismaClient
// ---------------------------------------------------------------------------

declare module "@prisma/client" {
  interface PrismaClient {
    readonly bookFavorite: BookFavoriteDelegate;
    readonly problemFavorite: ProblemFavoriteDelegate;
    readonly problemPracticeActivity: ProblemPracticeActivityDelegate;
    // A390
    readonly readerBookmark: ReaderBookmarkDelegate;
    readonly readerNote: ReaderNoteDelegate;
    // A392
    readonly learningActivity: LearningActivityDelegate;
    readonly readingSession: ReadingSessionDelegate;
    // A395
    readonly problemWrongBook: ProblemWrongBookDelegate;
  }
}
