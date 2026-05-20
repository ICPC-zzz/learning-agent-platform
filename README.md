# Learning Agent Platform

Current stage: Monorepo skeleton.

## Workspace Structure

```text
learning-agent-platform/
  apps/
    web/
  packages/
    ai-core/
    book-engine/
    learning-engine/
    db/
    shared/
```

## Install

```bash
pnpm install
```

## Start Web

```bash
pnpm dev
```

## Typecheck

```bash
pnpm typecheck
```

## Lint

```bash
pnpm lint
```

## Database Package

`packages/db` currently contains the Prisma schema and a lazy Prisma Client boundary. Importing the package does not automatically connect to a database. Real persistence and API integration are later tasks.

```bash
pnpm --filter @learning-agent-platform/db prisma:validate
pnpm --filter @learning-agent-platform/db typecheck
```

## Local database development

Copy `.env.example` to `.env`, then adjust `DATABASE_URL` for your local PostgreSQL instance. Do not commit the real `.env`.

```bash
pnpm --filter @learning-agent-platform/db prisma:validate
pnpm --filter @learning-agent-platform/db prisma:generate
pnpm --filter @learning-agent-platform/db prisma:migrate:dev
pnpm --filter @learning-agent-platform/db seed
```

`prisma:migrate:dev` and `seed` require a running local PostgreSQL database and a valid `DATABASE_URL`. The Web app is still not connected to the database; seed data is only minimal development demo data.

This repository is still in early MVP development. Real AI calls, embeddings, authentication, community, desktop app behavior, and production persistence flows are not implemented.
