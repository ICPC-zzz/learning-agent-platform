# A524 Server Deployment Readiness

Date: 2026-06-30

## Result

A524 added the missing server deployment readiness assets for the Web app.

## Added

```text
deploy/nginx/cfagent.fun.conf.example
deploy/systemd/learning-agent-platform.service.example
deploy/cron/content-sync.example
deploy/scripts/backup-postgres.sh.example
docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md
```

## Covered

- Ubuntu 24.04 base setup.
- Swap.
- Node/pnpm.
- PostgreSQL.
- Protected environment variables.
- Prisma `migrate deploy`.
- `pnpm run build`.
- `next start` behind systemd.
- Nginx reverse proxy to `http://127.0.0.1:3000`.
- `X-Forwarded-Proto=https` and `Host=cfagent.fun`.
- HTTPS and Cloudflare DNS-only guidance.
- Resend sender domain `auth.cfagent.fun`.
- Host-only session cookie guidance.
- `/api/health`.
- Database backup with `pg_dump`.
- Content sync cron using existing sync commands and `flock`.
- Rollback and log checks.

## Explicitly Avoided

Deployment scripts do not run:

```text
prisma db push
prisma migrate reset
git reset --hard
```

No real IP, password, API key, database URL credential, session token, or OTP was written into the deployment assets.

## Remaining Deployment Gates

- Run a real `pnpm email:smoke --to <test-email>` on the server.
- Complete real Browser Auth login/refresh/restart/logout.
- Confirm systemd restart keeps existing database-backed sessions valid.
- Configure production log rotation.
- Choose cron vs systemd timer for content sync.

```text
desktopEntryAllowed = false
```
