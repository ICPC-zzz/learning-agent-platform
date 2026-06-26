/**
 * Minimal demo user seed script for local development preview.
 *
 * Creates or reuses a single demo user for Reader DB sync and other
 * dev-only database features.  This script is NOT production-grade -
 * it intentionally skips auth, passwords, and role management.
 *
 * ## Usage
 *
 *   pnpm --filter @learning-agent-platform/db seed:demo-user
 *
 * Requires DATABASE_URL in the environment (no hardcoded fallback).
 *
 * Safety:
 * - Never outputs DATABASE_URL.
 * - Demo user is explicitly a development-preview identity.
 * - No real passwords, tokens, or secrets are stored.
 */

import {
  createPrismaClient,
  disconnectPrismaClient,
  PrismaUserRepository,
} from "../src/index.js";

const demoEmail = "demo@example.com";
const demoName = "Demo User";
const demoAuthProvider = "demo";
const demoAuthProviderId = "demo-user";

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const userRepository = new PrismaUserRepository(prisma);

  try {
    const user = await userRepository.findOrCreateUser({
      email: demoEmail,
      name: demoName,
      authProvider: demoAuthProvider,
      authProviderId: demoAuthProviderId,
    });

    console.info("Demo user seed complete.");
    console.info(`  email : ${demoEmail}`);
    console.info(`  name  : ${user.name ?? "(not set)"}`);
    console.info(`  id    : ${user.id}`);
    console.info(
      "This user is a development-preview identity only.  It does not represent a real account.",
    );

    // -- Seed sample book for Reader DB sync verification --

    const sampleBookId = "sample-programming-fundamentals";

    await prisma.book.upsert({
      where: { id: sampleBookId },
      create: {
        id: sampleBookId,
        title: "编程基础示例",
        author: "Learning Agent Platform",
        sourceType: "BUILTIN",
      },
      update: {},
    });

    console.info("Sample book seed complete.");
    console.info(`  book id : ${sampleBookId}`);

    const sampleChapters = [
      {
        id: "sample-chapter-variables",
        title: "第 1 章：变量",
        orderIndex: 0,
      },
      {
        id: "sample-chapter-control-flow",
        title: "第 2 章：控制流",
        orderIndex: 1,
      },
      {
        id: "sample-chapter-functions",
        title: "第 3 章：函数",
        orderIndex: 2,
      },
    ];

    for (const ch of sampleChapters) {
      await prisma.bookChapter.upsert({
        where: { id: ch.id },
        create: {
          id: ch.id,
          bookId: sampleBookId,
          title: ch.title,
          orderIndex: ch.orderIndex,
          level: 1,
        },
        update: {},
      });
    }

    console.info(`  chapters: ${sampleChapters.length} chapter(s) seeded`);

    // Seed long-scroll verification chapter with its own book and ContentChunk.
    // Uses a separate book ID to avoid colliding with sample-book mock data
    // (sampleBook.document.id === "sample-programming-fundamentals", which
    // causes reader-data.ts to short-circuit to mock data and skip the DB).
    // This chapter provides enough text to produce a scrollbar, enabling
    // ReaderScrollPositionTracker progressRatio > 0 verification.

    const scrollTestBookId = "reader-db-sync-verification-book";
    const scrollTestChapterId = "sample-chapter-long-scroll";

    await prisma.book.upsert({
      where: { id: scrollTestBookId },
      create: {
        id: scrollTestBookId,
        title: "Reader DB Sync Verification Book",
        author: "Learning Agent Platform",
        sourceType: "BUILTIN",
      },
      update: {},
    });

    console.info(`  scroll-test book seeded: ${scrollTestBookId}`);

    const scrollTestChapterTitle =
      "Chapter 1: Long Scroll Progress Verification";

    await prisma.bookChapter.upsert({
      where: { id: scrollTestChapterId },
      create: {
        id: scrollTestChapterId,
        bookId: scrollTestBookId,
        title: scrollTestChapterTitle,
        orderIndex: 0,
        level: 1,
      },
      update: {
        bookId: scrollTestBookId,
        title: scrollTestChapterTitle,
        orderIndex: 0,
      },
    });

    console.info(`  long-scroll chapter seeded: ${scrollTestChapterId}`);

    const LONG_SCROLL_PARAGRAPHS: string[] = [
      "Variables are one of the most fundamental concepts in programming. In most programming languages, a variable can be understood as a named memory container used to store data that a program needs during execution. You can think of a variable as a labeled box: the label is the variable name, and the contents of the box are the variable value. Understanding a variable lifecycle (when it is created and destroyed) and scope (where it can be accessed) is essential for writing correct programs.",
      "Control flow statements determine the order in which code executes within a program. The most basic control flow structures include sequential execution, conditional branching, and loops. Conditional branching allows a program to execute different code paths based on different conditions. Loop structures enable a program to repeatedly execute a block of code until a specific condition is met. The key to understanding control flow is being able to trace the execution path of a program and predict which code will execute under which conditions.",
      "Functions or methods are the basic building blocks for organizing code. A well-designed function should do one thing and do it well. The components of a function include: the function name describing what the function does, the parameter list what inputs the function needs, the return value what output the function produces, and the function body how the function accomplishes its work. Decomposing complex problems into a series of small functions is one of the most important skills in programming.",
      "Data types define what kind of values a variable can store and what operations can be performed on those values. Common primitive data types include integers, floating-point numbers, characters, strings, and booleans. Beyond primitive types, most languages also support composite types such as arrays, lists, dictionaries, and sets. Choosing the right data type has a significant impact on both program correctness and performance.",
      "Object-oriented programming is a programming paradigm that encapsulates data and operations on that data together. Its core concepts include classes as blueprints for defining objects, objects as instances of classes, encapsulation for hiding internal implementation details, inheritance for subclasses reusing parent class attributes and methods, and polymorphism where the same interface can have multiple different implementations.",
      "Data structures are ways that computers store and organize data. Common data structures include arrays, linked lists, stacks, queues, trees, and graphs. Each data structure has its applicable scenarios: stacks are suitable for LIFO scenarios such as function call stacks and undo operations; queues are suitable for FIFO scenarios such as task scheduling and message queues; tree structures are suitable for representing hierarchical relationships; graph structures are suitable for representing network relationships.",
      "Algorithms are a series of well-defined steps for solving specific problems. Algorithm efficiency is typically evaluated using Big O notation, which describes the trend of how an algorithm execution time or space requirements grow as the input size increases. Common time complexities include: O(1) constant time, O(log n) logarithmic time, O(n) linear time, O(n log n) linearithmic time, and O(n squared) quadratic time.",
      "Recursion is a programming technique where a function calls itself. Recursive functions typically contain two parts: a base case that stops the recursion and a recursive step where the function calls itself to solve a smaller subproblem. Classic recursive applications include computing factorials, Fibonacci sequences, the Tower of Hanoi problem, and tree traversal. The advantage of recursion is that the code is concise and logically clear.",
      "Error handling is an important part of writing robust programs. Various errors can occur during program execution: network connection failures, missing files, invalid user input, insufficient memory, and so on. Common error handling mechanisms include returning error codes, throwing exceptions, and using Result types as used in Rust and Swift. A good error handling strategy should accurately catch and identify error types, provide useful error information, and avoid leaking sensitive information.",
      "Testing is a key means of ensuring software quality. Common types of testing include: unit testing for individual functions or classes, integration testing for multiple modules working together, end-to-end testing simulating user operations, performance testing under specific loads, and security testing for vulnerabilities. Good tests should have repeatability, independence, speed, and readability.",
      "Version control systems are the cornerstone of team collaboration in development. Git is currently the most popular distributed version control system. Git core concepts include repositories, commits, branches, merges, and remote repositories such as GitHub and GitLab. Mastering Git means not only memorizing commands but more importantly understanding its data model as a content-addressable file system.",
      "Databases are the core component for persistent data storage in applications. Relational databases such as PostgreSQL and MySQL use tables, rows, and columns to organize data, operated through SQL. The core characteristics of relational databases are ACID: Atomicity, Consistency, Isolation, Durability. Non-relational databases use different data models: document databases, key-value stores, and graph databases.",
      "Network protocols are the rules and conventions for communication between computers. HTTP is the foundational protocol for web applications, defining the request-response model between clients and servers. HTTP request methods include GET, POST, PUT, and DELETE. HTTPS adds a TLS/SSL encryption layer on top of HTTP, ensuring data confidentiality and integrity during transmission.",
      "Asynchronous programming is a key technique for handling I/O intensive operations. In the traditional synchronous programming model, a program blocks and waits when executing I/O operations. Asynchronous programming allows a program to continue executing other tasks while waiting for I/O operations, significantly improving throughput. JavaScript async programming has gone through callbacks, Promises, and async/await syntax.",
      "Security should never be an afterthought in software development. Common web security threats include Cross-Site Scripting or XSS, SQL Injection, Cross-Site Request Forgery or CSRF, and sensitive data exposure. Defending against these attacks requires input validation, output encoding, parameterized queries, CSRF Tokens, and encrypted storage.",
      "Design patterns are reusable solutions to common software design problems. Creational patterns focus on object creation; structural patterns focus on how classes and objects are composed; behavioral patterns focus on object communication. Understanding the essence of design patterns is more important than memorizing their specific implementations.",
      "Performance optimization is a systematic engineering effort. At the frontend level, optimization includes reducing HTTP requests, compressing resources, using CDNs, and lazy loading. At the backend level, optimization includes database index optimization, query caching, connection pool management, and horizontal scaling. The first step is always measurement to find the real bottleneck.",
      "Containerization technologies like Docker and container orchestration like Kubernetes have fundamentally changed how applications are deployed and managed. Containers package an application and all its dependencies in an isolated runtime environment. Kubernetes provides automated container deployment, scaling, and management capabilities.",
      "Continuous Integration and Continuous Deployment or CI/CD are important components of modern software development. CI refers to frequently merging code changes and ensuring quality through automated builds and tests. CD extends CI by automatically deploying tested code to production. CI/CD pipelines include code checking, compilation, testing, security scanning, and deployment.",
      "The choice of programming language often depends on the specific application scenario and team experience. Python dominates data science and machine learning. JavaScript/TypeScript is the standard for web frontend development and also usable for backend through Node.js. Go is popular in cloud-native domains. Rust provides memory safety with performance close to C++.",
    ];

    const scrollTestChunkId = "scroll-test-chunk-0";

    await prisma.contentChunk.upsert({
      where: {
        chapterId_orderIndex: {
          chapterId: scrollTestChapterId,
          orderIndex: 0,
        },
      },
      create: {
        id: scrollTestChunkId,
        bookId: scrollTestBookId,
        chapterId: scrollTestChapterId,
        plainText: LONG_SCROLL_PARAGRAPHS.join("\n\n"),
        orderIndex: 0,
      },
      update: {
        bookId: scrollTestBookId,
        chapterId: scrollTestChapterId,
        plainText: LONG_SCROLL_PARAGRAPHS.join("\n\n"),
      },
    });

    console.info(
      `  long-scroll chunk seeded: ${scrollTestChunkId} (${LONG_SCROLL_PARAGRAPHS.length} paragraphs)`,
    );
  } finally {
    await disconnectPrismaClient(prisma);
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  // Never output DATABASE_URL or full connection strings.
  const safeMessage = message.replace(
    /postgres(ql)?:\/\/[^\s]+/gi,
    "postgresql://***",
  );

  console.error("Failed to seed demo user:", safeMessage);
  process.exitCode = 1;
});
