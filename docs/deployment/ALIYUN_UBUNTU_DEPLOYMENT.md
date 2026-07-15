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

The service starts the completed production build directly with Node.js and listens on `127.0.0.1:3000`. Do not use `pnpm` as the systemd entrypoint: release deployments that reuse an existing `node_modules` directory can otherwise trigger pnpm's non-interactive dependency reconciliation. The service sets `NODE_PATH` to `packages/db/node_modules` so the Prisma client remains resolvable at runtime.

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

Production content sync uses a systemd timer. Do not install the legacy
`deploy/cron/content-sync.example` entries: package-manager commands can try to
reconcile dependencies inside a reused release and fail in a non-interactive
scheduler.

Before switching a new release, install the no-build runner and attach its data
directory to persistent storage:

```bash
RELEASE=/opt/learning-agent-platform/releases/<release-directory>
cd "$RELEASE"
install -m 0755 deploy/scripts/run-content-sync.sh.example deploy/scripts/run-content-sync.sh
install -m 0755 deploy/scripts/prepare-content-data.sh.example deploy/scripts/prepare-content-data.sh
./deploy/scripts/prepare-content-data.sh "$RELEASE"
```

`prepare-content-data.sh` initializes
`/opt/learning-agent-platform/shared/content-data` only when a generated file
does not exist there, then links the release-level `apps/web/src/data`
directory to that shared directory. Run it for every new release before the
atomic `current` switch so article data cannot roll back during deployment.

Install the service and timer templates after replacing `APP_USER` with the
production application account. If the protected environment file is not
`/etc/learning-agent-platform/web.env`, replace that path in the service before
installation.

```bash
sed 's/APP_USER/admin/g; s#/etc/learning-agent-platform/web.env#/etc/learning-agent-platform.env#g' \
  deploy/systemd/learning-agent-platform-content-sync.service.example \
  | sudo tee /etc/systemd/system/learning-agent-platform-content-sync.service >/dev/null
sudo install -m 0644 \
  deploy/systemd/learning-agent-platform-content-sync.timer.example \
  /etc/systemd/system/learning-agent-platform-content-sync.timer
sudo systemctl daemon-reload
sudo systemctl enable --now learning-agent-platform-content-sync.timer
```

The timer runs one batch every day at `06:00:00 Asia/Shanghai`. Its
`Persistent=true` setting catches up after a boot that missed 06:00. The
oneshot service executes the existing TypeScript CLI directly through the
already-installed `tsx` runtime and must not install dependencies or build on
the server. The service caps the complete sync process tree at 25% of one CPU
to prevent article normalization from saturating a small production instance.
The existing commands remain available for authenticated manual
administration, but the production timer does not invoke them:

```text
content:sync:hot
content:sync:github-daily
content:sync:articles
content:sync:all
```

Remove only the three old content-sync lines from
`/etc/cron.d/learning-agent-platform`; keep the PostgreSQL backup line. Keeping
both cron and the timer enabled would create duplicate attempts.

Inspect and manually catch up with:

```bash
systemctl list-timers learning-agent-platform-content-sync.timer --all
sudo systemctl start learning-agent-platform-content-sync.service
sudo systemctl status learning-agent-platform-content-sync.service --no-pager
sudo journalctl -u learning-agent-platform-content-sync.service -n 100 --no-pager
```

Keep secrets in the protected environment file, never in unit files or
crontab. The journal records safe summaries and exit status. Existing sync
failures keep the previous successful generated snapshots. If legacy
file-based sync logs are retained during migration, keep log rotation enabled
for `/var/log/learning-agent-platform/*.log` until those files are retired.

To roll back scheduling without deleting content, disable the timer and restore
the backed-up cron file:

```bash
sudo systemctl disable --now learning-agent-platform-content-sync.timer
sudo cp /etc/cron.d/learning-agent-platform.before-content-timer \
  /etc/cron.d/learning-agent-platform
```

Do not remove `/opt/learning-agent-platform/shared/content-data` during a
scheduler rollback.

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
