# A520 Desktop Entry Gate

Date: 2026-06-30

## Gate Decision

```text
desktopEntryAllowed = false
```

Web 尚未完成，禁止进入 Desktop 开发。A523 后门禁仍关闭。

## Why Desktop Is Blocked

Desktop work must not start while the Web foundation still has unresolved P0 gaps:

1. Real email OTP send/receive is still blocked by missing Provider configuration.
2. Full Browser Auth flow is incomplete: login persistence, restart recovery, logout revocation, admin flow, and A/B isolation are not fully verified.
3. Automated browser E2E coverage is missing.
4. Legacy preview/dev-session/localStorage fallback remains in books, reader, import, and several user subpages.
5. Content scheduler is not deployment-neutral.
6. AI provider is preview/mock-only or real-dev only, not production-ready.
7. Codeforces Browser flow is not fully verified under a real bound user session.
8. 404 and remaining preview routes are not fully product-polished.

## Required Web Exit Criteria Before Desktop

- Complete real email OTP send/receive/verify with a configured Provider.
- Verify `lap_session` login persistence, restart recovery, and logout revocation in Browser.
- Add committed browser E2E for core flows: auth, articles, favorites, user dashboard, AI, Codeforces, admin sync, responsive smoke.
- Verify admin routes in Browser with an authorized admin session.
- Verify two-user A/B isolation for key data surfaces.
- Add scheduler/cron deployment path for daily content sync, with lock/stale/failure preservation retained.
- Keep raw prompt/response and secrets out of logs and docs.
- Keep Agent/tool/Skill execution gated by permission, audit logs, and explicit user action.

## Future Desktop Direction Only

The future Desktop app should not be a separate mock product. It should be one stronger main Agent client that reuses Web/server capabilities and boundaries:

- Reuse Web/server auth identity, LLM provider config, memory, tool runtime, Skill manifests, Codeforces data, reports, review plans, code analysis, and safety audit records.
- Keep all tools permissioned and logged.
- Keep community Skills disabled by default.
- Treat Desktop as an execution/control surface over existing server-reviewed capabilities, not a bypass around Web guards.

## Non-Goals For Current Stage

- No `apps/desktop` code changes.
- No Desktop scaffold or UI implementation.
- No autonomous tool execution.
- No production claims for dev-only AI/Agent capabilities.
