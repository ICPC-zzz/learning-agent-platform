# A503 Model Provider Cleanup Manifest

Generated: 2026-06-26

## Scope

This manifest covers only the AI model Provider / Model Profile / Credential chain and directly blocking repository exports. It does not clean books, reader, import, OJ, Docker, VJudge, or other legacy modules.

## Actual Deletions

None.

No file met all deletion criteria. The main problem was not extra live code; it was that A502 deleted active repository implementations and exports while current callers still depended on them.

## Restored Current Code

| Path | Symbols | Classification | Reason | Verification |
|---|---|---|---|---|
| `packages/db/src/repositories/model-provider-repository.ts` | `PrismaModelProviderRepository`, `ModelProviderRepository`, `ModelProviderRecord`, `ModelProfileRecord` | CURRENT_CANONICAL | Current Provider and Model Profile data boundary. | Runtime export test, typecheck. |
| `packages/db/src/repositories/codeforces-account-repository.ts` | `PrismaCodeforcesAccountRepository`, Codeforces account/stat types | CURRENT_CANONICAL | Current Personal/Codeforces analysis modules import it. | typecheck. |
| `packages/db/src/repositories/email-otp-repository.ts` | `PrismaEmailOtpRepository` | CURRENT_CANONICAL | Current email login flow imports it. | A468 schema test, typecheck. |
| `packages/db/src/repositories/article-repository.ts` | `PrismaArticleRepository` | CURRENT_CANONICAL | Current article favorite/recent reading DB actions import it through root exports. | typecheck. |
| `packages/db/src/repositories/daily-content-repository.ts` | `PrismaDailyContentRepository`, `DailyContentRepository`, `DailyContentRecord` | CURRENT_CANONICAL | Current daily content loader imports repository types. | typecheck. |
| `packages/db/src/repositories/index.ts` | repository barrel exports | CURRENT_CANONICAL | Ensures runtime class exports are values, not type-only exports. | typecheck. |
| `packages/db/src/index.ts` | package root exports | CURRENT_CANONICAL | Web imports `PrismaModelProviderRepository` from package root. | runtime export test. |
| `packages/db/package.json` | `./repositories/model-provider-repository` export | CURRENT_CANONICAL | Keeps root and subpath build exports aligned. | db build, built import check. |

## Schema Restoration

| Model / Enum | Classification | Source / Basis |
|---|---|---|
| `ModelProvider`, `UserModelCredential`, `ModelProfile` | CURRENT_CANONICAL | Existing migration `20260622_add_model_provider_models`. |
| `ModelProviderType`, `ModelAuthMode`, `ModelConnectionStatus`, `ModelUsageType` | CURRENT_CANONICAL | Existing migration `20260622_add_model_provider_models`. |
| `CodeforcesAccount`, `CodeforcesUserProblemStat`, `CodeforcesRatingChange`, `CodeforcesRecentSubmission` | CURRENT_CANONICAL | Existing migration `20260621_add_codeforces_account`; current Personal/AI modules import repository types. |
| `EmailOtpCode` | CURRENT_CANONICAL | Current email login actions and A468 tests require hashed OTP storage. |
| `ArticleFavorite`, `ArticleReading` | CURRENT_CANONICAL | Current article/user DB actions require them. |
| `DailyContentItem` | CURRENT_CANONICAL | Current daily content loader/repository contract requires it. |

## Kept Security / Dev-Only Code

| Path / Symbol | Classification | Reason |
|---|---|---|
| `packages/ai-core/src/model-gateway/credential-vault.ts` | KEEP_SECURITY | AES-256-GCM credential boundary. |
| `packages/ai-core/src/llm/external-chat-completions-provider.ts` | KEEP_SECURITY | Existing guarded OpenAI-compatible adapter; not duplicate Provider persistence. |
| `apps/web/src/lib/llm-dev-provider-config.ts` | KEEP_SECURITY | Existing dev-only status/config path referenced by admin and tests. |
| `apps/web/src/lib/llm-dev-health-check.ts` | KEEP_SECURITY | Existing dev-only health check path; not part of persisted Provider repository cleanup. |
| `apps/web/src/lib/assistant/providers/openai-compatible-llm-provider.ts` | REVIEW | Uses existing LLM adapter and has one pre-existing type cast outside this repository export fix. Not deleted because it is a current assistant provider wrapper. |

## Review Notes

- Existing `as unknown as` casts outside the Provider repository remain in unrelated Agent/reader/LLM areas. They were not changed because this round is limited to the Provider creation chain and typecheck restoration.
- `packages/db/src/generated-prisma-shim.ts` is now inert but still present. It is kept for this round because removing the historical shim is a separate cleanup task and not required for the Provider runtime fix.
- No `git add`, `git commit`, or `git push` was run.
