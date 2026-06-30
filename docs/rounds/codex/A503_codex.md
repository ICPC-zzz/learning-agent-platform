# A503 - Fix AI Assistant Provider Creation Chain

Date: 2026-06-26

## 1. Round Scope

This round fixes the AI assistant Model Provider creation path and restores the current repository/data boundary that A502 removed.

Out of scope: legacy books, reader, OJ/judge, Docker, VJudge, large reference projects, git operations, and destructive database operations.

## 2. User Constraint Compliance

- No `git add`, `git commit`, or `git push` was run.
- No `prisma db push`, `migrate reset`, destructive cleanup, or data wipe was run.
- No external reference project was read.
- No API key or plaintext provider credential was written to application data.

## 3. Failure Being Fixed

The visible runtime failure was:

```text
PrismaModelProviderRepository is not a constructor
```

Root cause: A502 removed the runtime repository implementation and barrel exports while current Web and AI modules still instantiate `PrismaModelProviderRepository`.

## 4. Canonical Chain Restored

The intended chain is now restored:

```text
apps/web Provider UI/actions
  -> @learning-agent-platform/db root export
  -> PrismaModelProviderRepository
  -> Prisma ModelProvider / UserModelCredential / ModelProfile
```

## 5. Prisma Schema Restored

`packages/db/prisma/schema.prisma` now includes the current business models/enums required by active modules:

- `ModelProvider`, `UserModelCredential`, `ModelProfile`
- `ModelProviderType`, `ModelAuthMode`, `ModelConnectionStatus`, `ModelUsageType`
- `CodeforcesAccount`, `CodeforcesUserProblemStat`, `CodeforcesRatingChange`, `CodeforcesRecentSubmission`
- `EmailOtpCode`
- `ArticleFavorite`, `ArticleReading`
- `DailyContentItem`
- `User.emailVerifiedAt`, `User.codeforcesAccount`, `User.modelProviders`

## 6. Migration Added

Added:

```text
packages/db/prisma/migrations/20260626_restore_current_business_models/migration.sql
```

This migration covers missing current tables not already covered by existing migrations. Provider and Codeforces tables were not duplicated because existing migrations already define them.

The migration was not executed in this round.

## 7. Repository Implementations Restored

Restored current repository files:

- `packages/db/src/repositories/model-provider-repository.ts`
- `packages/db/src/repositories/codeforces-account-repository.ts`
- `packages/db/src/repositories/article-repository.ts`
- `packages/db/src/repositories/email-otp-repository.ts`
- `packages/db/src/repositories/daily-content-repository.ts`

## 8. Runtime Exports Restored

Updated:

- `packages/db/src/repositories/index.ts`
- `packages/db/src/index.ts`
- `packages/db/package.json`

`PrismaModelProviderRepository` is exported as a runtime value from the package root and as a build subpath export.

## 9. Provider Repository Safety Notes

`PrismaModelProviderRepository` keeps credential operations separate from provider listing:

- Provider listing includes Provider/Profile relations, not raw secrets.
- Credential save/read uses `UserModelCredential`.
- Test coverage checks that no plaintext test token leaks through provider listing.
- The restored Provider repository does not use `as unknown as`.

## 10. Provider Cleanup Result

No Provider-domain file met deletion criteria.

Cleanup/classification manifest:

```text
docs/status/A503_MODEL_PROVIDER_CLEANUP_MANIFEST.md
```

## 11. Kept Security-Boundary Code

Kept intentionally:

- `packages/ai-core/src/model-gateway/credential-vault.ts`
- `packages/ai-core/src/llm/external-chat-completions-provider.ts`
- `apps/web/src/lib/llm-dev-provider-config.ts`
- `apps/web/src/lib/llm-dev-health-check.ts`
- `apps/web/src/lib/assistant/providers/openai-compatible-llm-provider.ts`

These are not duplicate Provider persistence repositories.

## 12. Legacy Minimal Fix

`apps/web/src/app/import/problem-api-import-server-action.ts` had a stale `ProblemDifficulty` fallback of `UNKNOWN`.

It was changed to `MEDIUM` only because the current app typecheck includes this legacy file. No broader import/legacy feature work was done.

## 13. Prisma Client Generation

Passed:

```bash
pnpm --dir packages/db run prisma:generate
```

Note: this workspace currently contains both root-level npm-style `node_modules/@prisma/client` and pnpm workspace client links. The active db package path resolves to the pnpm client and exposes the restored Provider delegates.

## 14. Typecheck Verification

Passed:

```bash
pnpm --dir apps/web run typecheck
pnpm --dir packages/db run typecheck
pnpm --dir packages/ai-core run typecheck
pnpm --dir packages/book-engine run typecheck
pnpm --dir packages/learning-engine run typecheck
pnpm --dir packages/shared run typecheck
```

Final log:

```text
.codex_tmp/a503_final_typecheck.log
```

## 15. Test Verification

Passed:

```bash
pnpm exec tsx --test tests/a503-model-provider-runtime-export.test.mjs
node apps/web/src/app/a468-email-otp-schema.test.mjs
pnpm exec tsx --test tests/a490-credential-vault.test.mjs
```

Test log:

```text
.codex_tmp/a503_tests.log
```

## 16. Build Export Verification

Passed:

```bash
pnpm --dir packages/db run build
```

Also verified that the built db package root export and subpath export point to the same runtime `PrismaModelProviderRepository` class.

## 17. Real Provider CRUD Verification

Passed through the db package client boundary:

```bash
pnpm --dir packages/db exec tsx ../../.codex_tmp/a503_provider_crud_verify.ts
```

Result:

```json
{"ok":true,"providerListed":true,"profileListed":true,"credentialStored":true,"secretLeaked":false}
```

The script created a temporary user, Provider, encrypted credential, and model profile, verified reads, checked no plaintext token leaked in Provider listing, then deleted the temporary user.

## 18. Browser Verification

Started the Web dev server and checked:

- `http://localhost:3000/`
- `http://localhost:3000/articles`
- `http://localhost:3000/problems`
- `http://localhost:3000/user`
- `http://localhost:3000/ai`

All returned HTTP 200.

In the browser, `/ai` loaded and the Model Management tab rendered Provider management UI. The observed Provider list error was an expected unauthenticated-session error, not a constructor/export/runtime error.

## 19. Remaining Risk

There are still historical app files that directly import `@prisma/client` outside the db package boundary. They are not part of the Provider creation-chain fix and should be handled in a later boundary cleanup round.

Root-level stale generated Prisma client artifacts also exist because this workspace has mixed historical package-manager artifacts. The db package path used by the restored Provider chain resolves to the updated pnpm client.

## 20. Final Status

A503 Provider creation-chain fix is complete:

- runtime constructor export restored;
- current Provider schema restored;
- repository implementation restored;
- build export path restored;
- app/package typechecks pass;
- focused Provider tests pass;
- real Provider/Profile/Credential CRUD verification passes;
- browser UI no longer hits the constructor error.
