# Aliyun Ubuntu Deployment

This document is a production deployment checklist for `cfagent.fun` on Ubuntu 24.04. All values are placeholders; keep real secrets in `/etc/learning-agent-platform/web.env` or another protected secret store.

## Server Base

1. Create a non-root `APP_USER`.
2. Configure swap if the instance is small:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

3. Install Node.js LTS, pnpm, PostgreSQL, Nginx, Certbot, and `flock`.

## Environment

Create `/etc/learning-agent-platform/web.env` with mode `600` and owner `APP_USER`.

Required placeholders:

```env
NODE_ENV=production
APP_BASE_URL=https://cfagent.fun
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE
LAP_EMAIL_AUTH_ENABLED=true
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL=CF Agent <no-reply@auth.cfagent.fun>
LAP_ADMIN_EMAILS=admin@example.com
LAP_INTERNAL_SCHEDULER_SECRET=replace_with_random_secret
LAP_CODEFORCES_EXTERNAL_API_ENABLED=false
AI_PROVIDER_MODE=mock
AI_PROVIDER_NETWORK_ENABLED=false
LAP_CONTENT_SYNC_ENABLED=true
```

Use `auth.cfagent.fun` only for Resend sending. Do not set a cookie `Domain=.cfagent.fun`; the web session cookie should stay host-only for `cfagent.fun`.

## Build And Migrate

```bash
cd /opt/learning-agent-platform
pnpm install --frozen-lockfile
set -a; source /etc/learning-agent-platform/web.env; set +a
pnpm --filter @learning-agent-platform/db exec prisma migrate deploy --schema prisma/schema.prisma
pnpm run build
pnpm email:doctor
```

Do not use `prisma db push`, `prisma migrate reset`, or `git reset --hard` on the server.

## systemd

Copy `deploy/systemd/learning-agent-platform.service.example` to:

```text
/etc/systemd/system/learning-agent-platform.service
```

Then adjust `APP_USER` and paths.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now learning-agent-platform
sudo journalctl -u learning-agent-platform -f
```

The service runs `next start` through `pnpm --filter @learning-agent-platform/web start` and listens on `127.0.0.1:3000`.

## Nginx And HTTPS

Use `deploy/nginx/cfagent.fun.conf.example` as the base config. The proxy must send:

```text
Host=cfagent.fun
X-Forwarded-Proto=https
X-Forwarded-For=<client chain>
```

Cloudflare should be DNS-only during certificate issuance. Re-enable proxying only after HTTPS and origin headers are verified.

## Health Check

Use:

```bash
curl -fsS https://cfagent.fun/api/health
```

Expected success shape:

```json
{"status":"ok","database":"ok","timestamp":"..."}
```

The endpoint does not expose paths, environment variables, database URLs, provider keys, or version details.

## Email

Run a non-OTP smoke only after the Resend domain is verified and sending is enabled:

```bash
pnpm email:smoke --to tester@example.com
```

Then test `/auth/login` in the browser and read the OTP only from the real mailbox. Do not read OTP values from database rows or server logs.

## Admin Bootstrap

After the target user has logged in once and exists in the database:

```bash
pnpm auth:bootstrap-admin
```

Then log out and log in again, or refresh the session, before testing `/admin` and `/admin/sync`.

## Content Sync

Use `deploy/cron/content-sync.example` or convert it to systemd timers. It reuses the existing idempotent sync commands:

```text
content:sync:hot
content:sync:github-daily
content:sync:articles
content:sync:all
```

Keep secrets in the protected environment file, not in crontab. Configure log rotation for `/var/log/learning-agent-platform/*.log`. Sync failures should keep the previous successful generated snapshots.

## Database Backup

Use `deploy/scripts/backup-postgres.sh.example` from a protected environment with `DATABASE_URL` already loaded.

Recommended restore rehearsal:

```bash
createdb RESTORE_DATABASE
pg_restore --dbname=RESTORE_DATABASE /var/backups/learning-agent-platform/postgres/learning-agent-platform-TIMESTAMP.dump
```

## Rollback

1. Stop the service.
2. Switch to the previous known-good release directory or deployment artifact.
3. Run `pnpm install --frozen-lockfile` if dependencies changed.
4. Run `pnpm run build`.
5. Start the service and verify `/api/health`.

Do not use destructive Git or Prisma reset commands as rollback.

## Logs

Check:

```bash
sudo journalctl -u learning-agent-platform --since "30 min ago"
sudo tail -n 200 /var/log/nginx/error.log
sudo tail -n 200 /var/log/learning-agent-platform/content-sync-hot.log
```

Logs must not contain API keys, session tokens, database URLs, raw OTP codes, or raw provider responses.
