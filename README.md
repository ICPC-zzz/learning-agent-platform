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

## License

This project is source-available for non-commercial use only.
Commercial use requires prior written permission from the copyright holder.
For commercial licensing, please contact: gptcode553@gmail.com

**Allowed** without commercial permission:
- personal use
- educational use
- research use
- evaluation use
- non-profit use

**Not allowed** without commercial permission:
- use in a paid product or service
- use in a SaaS platform
- use by or for a for-profit company
- resale, sublicensing, or monetization
- using this project to generate revenue or commercial advantage
