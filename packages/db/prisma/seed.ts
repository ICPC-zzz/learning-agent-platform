import {
  createPrismaClient,
  disconnectPrismaClient,
  PrismaBookRepository,
  PrismaLearningRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "../src/index.js";
import type {
  CreateBookWithContentInput,
  CreateDailyRecommendationItemInput,
  CreateProblemInput,
} from "../src/index.js";

const demoUserInput = {
  email: "demo@example.com",
  name: "Demo Learner",
  authProvider: "demo",
  authProviderId: "demo-user",
} as const;

const demoBookTitle = "Programming Fundamentals Demo";
const seedProblemSource = "seed:demo";

const demoBookInput: CreateBookWithContentInput = {
  title: demoBookTitle,
  sourceType: "IMPORTED_TEXT",
  sourceMetadata: {
    seed: true,
    seedKey: "programming-fundamentals-demo",
    description: "Small local development seed book for repository and reader checks.",
  },
  chapters: [
    {
      title: "Chapter 1: Variables",
      level: 1,
      orderIndex: 0,
      plainText:
        "Variables store named values so programs can reuse data. Clear names make programs easier to understand.",
    },
    {
      title: "Chapter 2: Control Flow",
      level: 1,
      orderIndex: 1,
      plainText:
        "Control flow decides which statements run and how often they run.",
    },
  ],
  chunks: [
    {
      chapterOrderIndex: 0,
      plainText:
        "Variables give a name to a value. A useful variable name explains what the value means in the program.",
      orderIndex: 0,
      charCount: 104,
      startOffset: 0,
      endOffset: 104,
    },
    {
      chapterOrderIndex: 0,
      plainText:
        "Changing a variable should make the program easier to understand, not harder to follow.",
      orderIndex: 1,
      charCount: 83,
      startOffset: 105,
      endOffset: 188,
    },
    {
      chapterOrderIndex: 1,
      plainText:
        "An if statement chooses between branches. A loop repeats work until a condition changes.",
      orderIndex: 0,
      charCount: 87,
      startOffset: 0,
      endOffset: 87,
    },
  ],
};

const demoProblems: CreateProblemInput[] = [
  {
    title: "Name a variable for a total price",
    description:
      "Choose a clear variable name for storing the total price of items in a cart.",
    difficulty: "EASY",
    tags: ["fundamentals"],
    source: seedProblemSource,
    metadata: {
      seed: true,
      seedKey: "variable-total-price",
    },
  },
  {
    title: "Trace a loop counter",
    description:
      "Given a short loop, identify the values produced by the counter at each step.",
    difficulty: "MEDIUM",
    tags: ["algorithm", "fundamentals"],
    source: seedProblemSource,
    metadata: {
      seed: true,
      seedKey: "trace-loop-counter",
    },
  },
  {
    title: "Fix a branch condition bug",
    description:
      "A conditional handles the boundary value incorrectly. Explain the bug and fix the condition.",
    difficulty: "HARD",
    tags: ["debugging", "algorithm"],
    source: seedProblemSource,
    metadata: {
      seed: true,
      seedKey: "branch-condition-bug",
    },
  },
];

function getUtcStartOfToday(): Date {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const userRepository = new PrismaUserRepository(prisma);
  const bookRepository = new PrismaBookRepository(prisma);
  const learningRepository = new PrismaLearningRepository(prisma);
  const readingProgressRepository = new PrismaReadingProgressRepository(prisma);

  try {
    const user = await userRepository.findOrCreateUser(demoUserInput);
    const existingBook = await prisma.book.findFirst({
      where: {
        OR: [{ ownerId: user.id }, { ownerId: null }],
        sourceType: "IMPORTED_TEXT",
        title: demoBookTitle,
      },
      include: {
        chapters: {
          include: {
            chunks: true,
          },
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    });

    const bookId =
      existingBook?.id ??
      (await bookRepository.createBookWithContent(demoBookInput)).bookId;

    if (existingBook?.ownerId !== user.id) {
      await prisma.book.update({
        where: {
          id: bookId,
        },
        data: {
          ownerId: user.id,
          description:
            "Small local development seed book for repository and reader checks.",
          language: "en",
          tags: ["fundamentals", "seed"],
        },
      });
    }

    const chapter = await prisma.bookChapter.findFirstOrThrow({
      where: {
        bookId,
      },
      include: {
        chunks: {
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
      orderBy: {
        orderIndex: "asc",
      },
    });
    const firstChunk = chapter.chunks[0];

    if (firstChunk !== undefined) {
      await readingProgressRepository.upsertReadingProgress({
        userId: user.id,
        bookId,
        chapterId: chapter.id,
        lastChunkId: firstChunk.id,
        progressRatio: 0.35,
      });
    }

    const problems = await Promise.all(
      demoProblems.map(async (problemInput) => {
        const existingProblem = await prisma.problem.findFirst({
          where: {
            title: problemInput.title,
            source: seedProblemSource,
          },
        });

        return (
          existingProblem ??
          learningRepository.createProblem({
            ...problemInput,
          })
        );
      }),
    );

    await learningRepository.upsertAbilityProfile({
      userId: user.id,
      overallScore: 62,
      readingScore: 64,
      languageFundamentalsScore: 68,
      algorithmScore: 55,
      debuggingScore: 58,
      engineeringPracticeScore: 60,
      systemDesignScore: 35,
      lastEvaluatedAt: new Date(),
    });

    const recommendationDate = getUtcStartOfToday();
    const existingRecommendations = await prisma.dailyRecommendation.findMany({
      where: {
        userId: user.id,
        recommendationDate,
        problemId: {
          in: problems.map((problem) => problem.id),
        },
      },
      select: {
        problemId: true,
      },
    });
    const existingRecommendationProblemIds = new Set(
      existingRecommendations.map((recommendation) => recommendation.problemId),
    );
    const recommendationItems = problems
      .filter((problem) => !existingRecommendationProblemIds.has(problem.id))
      .map<CreateDailyRecommendationItemInput>((problem, orderIndex) => ({
        problemId: problem.id,
        reason: `Seed demo recommendation ${orderIndex + 1}: useful for local database development checks.`,
      }));

    if (recommendationItems.length > 0) {
      await learningRepository.createDailyRecommendations({
        userId: user.id,
        recommendationDate,
        recommendations: recommendationItems,
      });
    }

    console.info("Seeded local demo data for packages/db.");
  } finally {
    await disconnectPrismaClient(prisma);
  }
}

main().catch((error: unknown) => {
  console.error("Failed to seed local demo data.", error);
  process.exitCode = 1;
});
