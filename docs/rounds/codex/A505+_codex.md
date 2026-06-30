# A505+ - Root Typecheck Script Repair

Date: 2026-06-27

## Scope

This follow-up fixed the recurring root-level `pnpm run typecheck` failure.

No product logic, database schema, Prisma migration, LLM call, tool execution, or Git operation was added.

## Problem

Root typecheck failed before TypeScript execution in the local Windows bash environment:

```text
tee: /dev/stderr: No such file or directory
```

After removing that blocker, two more script-environment issues surfaced:

- `python3` resolved to the WindowsApps placeholder and exited with code 49.
- Python `os.symlink()` failed with `WinError 1314` because the current user lacks symlink privileges.

## Fix

Updated `scripts/vm-typecheck.sh`:

- Replaced `tee /dev/stderr` with a temporary helper log and `cat ... >&2`.
- Added Python interpreter selection across `python3`, `python`, and `py`.
- Printed helper logs even when the helper fails.

Updated `scripts/vm-typecheck-helper.py`:

- Kept symlink as the preferred fast path.
- Added `shutil.copytree()` fallback when symlink creation is unavailable.

## Verification

Passed:

```powershell
pnpm run typecheck
```

Observed result:

```text
PASS: typecheck 0 errors
```

## Files

Updated:

- `scripts/vm-typecheck.sh`
- `scripts/vm-typecheck-helper.py`
- `docs/status/A505_CONTEXT_COMPRESSION_CLOSURE.md`
- `docs/rounds/codex/A505_codex.md`
- `docs/rounds/codex/A505+_codex.md`
- `docs/codex-context/CURRENT_HANDOFF.md`
