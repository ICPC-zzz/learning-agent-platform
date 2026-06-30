# A526 Content Scheduler Closure

Date: 2026-06-30

## Result

Content scheduler assets are ready as deployment templates.

```text
contentSchedulerReady = true
serverSchedulerInstalled = false
```

## Verified

- Root commands exist:
  - `content:sync:hot`
  - `content:sync:github-daily`
  - `content:sync:articles`
  - `content:sync:all`
- Cron template loads `/etc/learning-agent-platform/web.env`.
- Cron template uses `flock` per job.
- Hot topics schedule: every 6 hours.
- Technical articles schedule: every 6 hours.
- GitHub daily schedule: once daily.
- Secrets are not embedded in crontab.
- Deployment doc covers logs, backups, restore rehearsal, `prisma migrate deploy`, and rollback.

## Tests

```text
node --test tests/a526-content-scheduler-contract.test.mjs
passed
```

## Not Executed

Cron/systemd timers were not installed on the real server in this turn.
