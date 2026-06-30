# A525 Server Deployment Gate

Date: 2026-06-30

## Gate Decision

Server pre-deployment is not yet allowed.

```text
serverDeploymentReady = false
```

## Passed

- Production build passed.
- `/api/health` returned:

```text
status = 200
database = ok
```

- `email:doctor` reported:

```text
provider = resend
fromDomain = auth.cfagent.fun
fromValid = true
realSendAllowed = true
blockedReasons = none
```

- Deployment assets from A524 still exist:

```text
deploy/nginx/cfagent.fun.conf.example
deploy/systemd/learning-agent-platform.service.example
deploy/cron/content-sync.example
deploy/scripts/backup-postgres.sh.example
docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md
```

No secrets were written to deployment assets.

## Build Note

The first `pnpm run build` attempt failed because an older local production Web process was holding Prisma's Windows query engine DLL:

```text
EPERM rename query_engine-windows.dll.node.tmp -> query_engine-windows.dll.node
```

After stopping the older `pnpm --filter @learning-agent-platform/web start` and `next start` processes, the same build passed.

## Not Passed

- Real smoke email delivery: not executed because no test recipient mailbox was provided.
- Real OTP Browser login: not executed.
- Session persistence after refresh: not executed.
- Session persistence after service restart: not executed.
- Logout revocation: not executed.
- Admin Browser flow: not executed.
- Two-user isolation: not executed.
- Production log rotation: still not verified.
- Final content scheduler choice, cron vs systemd timer: still not verified on server.

## Gate

```text
serverDeploymentReady = false
desktopEntryAllowed = false
```

