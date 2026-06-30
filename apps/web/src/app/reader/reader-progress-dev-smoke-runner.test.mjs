import assert from "node:assert/strict";
import test from "node:test";

const {
  formatReaderProgressDevSmokeResult,
  runReaderProgressDevSmoke,
} = await import("./reader-progress-dev-smoke-runner.ts");

function makeSavedRecord(overrides = {}) {
  return {
    id: overrides.id ?? "progress-1",
    userId: overrides.userId ?? "user-1",
    bookId: overrides.bookId ?? "book-1",
    chapterId: overrides.chapterId ?? "chapter-1",
    lastChunkId: overrides.lastChunkId ?? "chunk-1",
    progressRatio: overrides.progressRatio ?? 0.64,
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-15T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-15T10:30:00.000Z"),
  };
}

function makeLiveEnv(overrides = {}) {
  return {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://dev-user:dev-pass@localhost:5432/lap",
    LAP_READER_PROGRESS_DEV_SMOKE_ENABLED: "true",
    LAP_ALLOW_REAL_DB_INTEGRATION: "1",
    ...overrides,
  };
}

function makeReaderData(bookId = "book-1", chapterId = "chapter-1") {
  return {
    book: {
      id: bookId,
      title: "Reader Progress Dev Smoke Book",
      author: "Learning Agent Platform",
      sourceType: "IMPORTED_TEXT",
      createdAt: new Date("2026-06-15T09:00:00.000Z"),
      updatedAt: new Date("2026-06-15T09:15:00.000Z"),
    },
    chapters: [
      {
        id: chapterId,
        bookId,
        parentId: null,
        title: "Reader Progress Dev Smoke Chapter",
        orderIndex: 0,
        level: 1,
      },
    ],
    chunks: [
      {
        id: "chunk-1",
        bookId,
        chapterId,
        orderIndex: 0,
        plainText: "Reader progress smoke test chunk content.",
      },
    ],
  };
}

function makeBookRepository({
  createBookResult,
  existingBooks = [],
  readerData,
  onCreate = () => {},
} = {}) {
  const state = {
    createCalls: 0,
    listCalls: 0,
    getCalls: [],
  };

  return {
    state,
    async listBooks() {
      state.listCalls += 1;
      return existingBooks;
    },
    async getBookReaderData(bookId) {
      state.getCalls.push(bookId);
      return readerData ?? makeReaderData(bookId);
    },
    async createBookWithContent(input) {
      state.createCalls += 1;
      onCreate(input);
      if (createBookResult !== undefined) {
        return createBookResult;
      }

      return {
        bookId: "smoke-book-1",
        chapterCount: input.chapters.length,
        chunkCount: input.chunks.length,
        chapterIds: [input.chapters[0].id ?? "chapter-1"],
      };
    },
  };
}

function makeReadingProgressRepository(record = makeSavedRecord()) {
  const state = {
    listCalls: [],
    upsertCalls: [],
    getCalls: [],
  };

  return {
    state,
    async listReadingProgress(input) {
      state.listCalls.push(input);
      return [record];
    },
    async upsertReadingProgress(input) {
      state.upsertCalls.push(input);
      return record;
    },
    async getReadingProgress(input) {
      state.getCalls.push(input);
      return record;
    },
  };
}

function makeUserRepository({
  existingUser = null,
  createdUser = {
    id: "user-1",
    email: "reader-progress-dev-smoke@example.com",
    name: "Reader Progress Dev Smoke",
    authProvider: "reader-progress-dev-smoke",
    authProviderId: "reader-progress-dev-smoke",
    createdAt: new Date("2026-06-15T09:00:00.000Z"),
    updatedAt: new Date("2026-06-15T09:00:00.000Z"),
  },
} = {}) {
  const state = {
    getCalls: [],
    findCalls: [],
  };

  return {
    state,
    async getUserByEmail(email) {
      state.getCalls.push(email);
      return existingUser;
    },
    async findOrCreateUser(input) {
      state.findCalls.push(input);
      return createdUser;
    },
  };
}

test("dry-run is default and does not touch repositories", async function () {
  const result = await runReaderProgressDevSmoke({
    env: {},
    liveRequested: false,
  });

  assert.equal(result.mode, "dry-run");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.resumeAvailable, false);
  assert.equal(result.databaseUrlPresent, false);
  assert.equal(result.preparationChecklist.length > 0, true);
  assert.equal(result.message.includes("Dry-run"), true);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
});

test("live run is blocked when DATABASE_URL is missing", async function () {
  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv({
      DATABASE_URL: undefined,
    }),
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.blockedReasons.some((reason) => reason.includes("MISSING_DEV_DATABASE_CONNECTION")), true);
  assert.equal(result.message.includes("blocked"), true);
});

test("live run is blocked when smoke guard is missing", async function () {
  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv({
      LAP_READER_PROGRESS_DEV_SMOKE_ENABLED: "false",
    }),
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.blockedReasons.some((reason) => reason.includes("LAP_READER_PROGRESS_DEV_SMOKE_ENABLED_REQUIRED")), true);
});

test("live run is blocked when real-db integration guard is missing", async function () {
  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv({
      LAP_ALLOW_REAL_DB_INTEGRATION: "false",
    }),
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.blockedReasons.some((reason) => reason.includes("LAP_ALLOW_REAL_DB_INTEGRATION_REQUIRED")), true);
});

test("live run is blocked in production", async function () {
  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv({
      NODE_ENV: "production",
    }),
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.blockedReasons.some((reason) => reason.includes("PRODUCTION_BLOCKED")), true);
});

test("live run with fake repositories completes the smoke chain", async function () {
  const bookRepository = makeBookRepository({
    existingBooks: [],
  });
  const readingProgressRepository = makeReadingProgressRepository();
  const userRepository = makeUserRepository();

  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv(),
    dependencies: {
      bookRepository,
      readingProgressRepository,
      userRepository,
    },
  });

  assert.equal(result.mode, "live");
  assert.equal(result.writesDatabase, true);
  assert.equal(result.callsRepository, true);
  assert.equal(result.resumeAvailable, true);
  assert.equal(result.progressPercent, 64);
  assert.equal(result.readerResume.hasContinueReading, true);
  assert.equal(result.bookDetail.status, "loaded");
  assert.equal(result.bookDetail.hasSavedProgress, true);
  assert.equal(result.userRecentReading.status, "loaded");
  assert.equal(result.userRecentReading.recentCount, 1);
  assert.equal(result.bookCreatedOrReused, "created");
  assert.equal(result.chapterCreatedOrReused, "created");
  assert.equal(result.userCreatedOrReused, "created");
  assert.equal(result.bookId !== null, true);
  assert.equal(result.chapterId !== null, true);
  assert.equal(bookRepository.state.createCalls, 1);
  assert.equal(readingProgressRepository.state.upsertCalls.length, 1);
  assert.equal(userRepository.state.findCalls.length, 1);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
});

test("live repository errors are sanitized", async function () {
  const result = await runReaderProgressDevSmoke({
    liveRequested: true,
    env: makeLiveEnv(),
    dependencies: {
      bookRepository: {
        async listBooks() {
          return [];
        },
        async getBookReaderData() {
          return makeReaderData();
        },
        async createBookWithContent() {
          throw new Error("DATABASE_URL=postgresql://secret-user:secret-pass@localhost/db");
        },
      },
      readingProgressRepository: makeReadingProgressRepository(),
      userRepository: makeUserRepository(),
    },
  });

  assert.equal(result.mode, "live_error");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.blockedReasons[0].includes("DATABASE_URL"), false);
  assert.equal(result.blockedReasons[0].includes("secret"), false);
  assert.equal(result.blockedReasons[0].includes("postgresql://"), false);
  assert.equal(JSON.stringify(result).includes("stack"), false);
});

test("source file does not import LLM, API, or agent tooling", async function () {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("./reader-progress-dev-smoke-runner.ts", import.meta.url), "utf8"),
  );

  assert.equal(source.includes("@learning-agent-platform/ai-core"), false);
  assert.equal(source.includes("OpenAI"), false);
  assert.equal(source.includes("anthropic"), false);
  assert.equal(source.includes("tool_search"), false);
  assert.equal(source.includes("fetch("), false);
});

test("formatter prints safe metadata and a preparation checklist", async function () {
  const result = await runReaderProgressDevSmoke({
    env: {},
    liveRequested: false,
  });
  const output = formatReaderProgressDevSmokeResult(result);

  assert.equal(output.includes("=== Reader Progress Dev Smoke ==="), true);
  assert.equal(output.includes("preparationChecklist:"), true);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("token"), false);
});
