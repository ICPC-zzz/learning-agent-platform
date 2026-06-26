<#
.SYNOPSIS
Reader DB sync minimal verification script -- development preview environment

.DESCRIPTION
Checks DATABASE_URL configuration status, runs demo user seed, outputs
manual verification steps. This script is for local dev preview only, NOT
for production. Never outputs DATABASE_URL values or any real credentials.

.NOTES
Safety constraints:
- Only checks whether DATABASE_URL is set, never prints the value
- Does not modify .env or .env.example
- Does not modify any business code
- Error messages use placeholder connection strings only
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Safe output helpers ──

function Write-SafeInfo {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-SafeSuccess {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-SafeWarning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-SafeError {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-SafeStep {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor White
}

# ── Header ──

Write-Host "==============================================" -ForegroundColor Magenta
Write-Host " Reader DB Sync Verification Script" -ForegroundColor Magenta
Write-Host " (Dev Preview -- Not Production)" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host ""

# ── 1. Project root check ──

Write-SafeStep "1. Checking project root directory"

$requiredFiles = @(
    "package.json",
    "packages/db/package.json",
    "apps/web/src/app/api/dev/db-health/route.ts"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -Path $file -PathType Leaf)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-SafeError "Missing required files:"
    foreach ($f in $missingFiles) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    Write-SafeWarning "Run this script from the project root directory."
    Write-Host "  Example: cd E:\code\learning-agent-platform; .\scripts\verify-reader-db-sync.ps1"
    exit 1
}

Write-SafeSuccess "Project root check passed"

# ── 2. Command availability check ──

Write-SafeStep "2. Checking required commands"

$allCommandsOk = $true

# Node
try {
    $nodeVersion = & node --version 2>&1
    Write-SafeSuccess "node available: $nodeVersion"
} catch {
    Write-SafeError "node is not available. Please install Node.js and retry."
    $allCommandsOk = $false
}

# pnpm
try {
    $pnpmVersion = & pnpm --version 2>&1
    Write-SafeSuccess "pnpm available: $pnpmVersion"
} catch {
    Write-SafeError "pnpm is not available. Please install pnpm and retry."
    $allCommandsOk = $false
}

if (-not $allCommandsOk) {
    exit 1
}

# ── 3. Check seed script ──

Write-SafeStep "3. Checking demo user seed script"

$seedScriptPath = "packages/db/scripts/seed-demo-user.ts"
if (-not (Test-Path -Path $seedScriptPath -PathType Leaf)) {
    Write-SafeError "Seed script not found: $seedScriptPath"
    exit 1
}
Write-SafeSuccess "Seed script found: $seedScriptPath"

# ── 4. Check DATABASE_URL ──

Write-SafeStep "4. Checking DATABASE_URL environment variable"

$dbUrl = $env:DATABASE_URL

if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-SafeError "DATABASE_URL is missing."

    Write-Host ""
    Write-Host "  DATABASE_URL is not set in the environment." -ForegroundColor Yellow
    Write-Host "  Set it in your local terminal and retry." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  PowerShell setup example (replace with your real connection info):" -ForegroundColor Yellow
    Write-Host '    $env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DB_NAME"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or create a .env file in the project root and set DATABASE_URL there." -ForegroundColor Yellow
    Write-Host "  Note: .env files must NOT be committed to Git." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  After setting, re-run: .\scripts\verify-reader-db-sync.ps1" -ForegroundColor Yellow
    Write-Host ""

    Write-SafeWarning "Script exiting safely due to missing DATABASE_URL. This is expected, not a failure."
    exit 0
}

Write-SafeSuccess "DATABASE_URL is set. Value is hidden."

# ── 5. Check Prisma client generation ──

Write-SafeStep "5. Checking Prisma client generation"

# Use Node.js to try importing @prisma/client from the packages/db directory.
# This works for all package managers (npm, yarn, pnpm) regardless of hoisting layout.
$prevLocation = Get-Location
try {
    Set-Location "packages/db"
    $null = node -e "require('@prisma/client')" 2>&1
    $prismaGenerated = ($LASTEXITCODE -eq 0)
} catch {
    $prismaGenerated = $false
} finally {
    Set-Location $prevLocation
}

if (-not $prismaGenerated) {
    Write-SafeWarning "Prisma client is not generated. The seed and DB operations require a generated Prisma client."

    Write-Host ""
    Write-Host "  Run the following command to generate the Prisma client:" -ForegroundColor Yellow
    Write-Host "    pnpm --filter @learning-agent-platform/db prisma:generate" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  After generating, re-run: .\scripts\verify-reader-db-sync.ps1" -ForegroundColor Yellow
    Write-Host ""

    Write-SafeWarning "Skipping seed step due to missing Prisma client. Generate the client and re-run the script to seed and verify."
} else {
    Write-SafeSuccess "Prisma client is generated."

    # ── 6. Run demo user seed ──

    Write-SafeStep "6. Running demo user seed"

    Write-SafeInfo "Command: pnpm --filter @learning-agent-platform/db seed:demo-user"
    Write-Host ""

    $seedExitCode = 0

    try {
        # Uses the seed:demo-user script defined in packages/db/package.json
        & pnpm --filter @learning-agent-platform/db seed:demo-user 2>&1
        $seedExitCode = $LASTEXITCODE
    } catch {
        Write-SafeWarning "Seed script execution error -- Prisma client may not be generated, or DB connection failed."
        Write-Host "  Verify: pnpm --filter @learning-agent-platform/db prisma:generate" -ForegroundColor Yellow
        Write-Host "  Verify: pnpm --filter @learning-agent-platform/db prisma:migrate:dev" -ForegroundColor Yellow
        $seedExitCode = 1
    }

    if ($seedExitCode -eq 0) {
        Write-Host ""
        Write-SafeSuccess "Demo user seed completed"
    } else {
        Write-Host ""
        Write-SafeWarning "Seed command exit code: $seedExitCode"
        Write-SafeWarning "Common causes: demo user already exists, Prisma client not generated, DB not running, schema not pushed."
        Write-Host "  This is not blocking -- if the demo user already exists, proceed with verification." -ForegroundColor Yellow
    }
}

# ── 6. Manual verification steps ──

Write-Host ""
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host " Manual Verification Steps" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta

Write-SafeStep "Step A: Start the Web dev server"
Write-Host ""
Write-Host "  In a separate terminal, run:" -ForegroundColor White
Write-Host "    pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Or (if root package.json has no dev script):" -ForegroundColor White
Write-Host "    pnpm --filter @learning-agent-platform/web dev" -ForegroundColor Gray
Write-Host ""

Write-SafeStep "Step B: Verify database connectivity"
Write-Host ""
Write-Host "  Open in browser:" -ForegroundColor White
Write-Host "    http://localhost:3000/api/dev/db-health" -ForegroundColor Gray
Write-Host ""
Write-Host "  Expected response:" -ForegroundColor White
Write-Host '    { "ok": true, "status": "connected", "mode": "development-preview" }' -ForegroundColor Gray
Write-Host ""
Write-Host "  If ok is false, check that PostgreSQL is running and DATABASE_URL is correct." -ForegroundColor Yellow
Write-Host ""

Write-SafeStep "Step C: Reader page manual verification -- scroll progress sync"
Write-Host ""
Write-Host "  1. Open any book chapter in the browser:" -ForegroundColor White
Write-Host "     http://localhost:3000/reader?bookId=<book_id>&chapterId=<chapter_id>" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Scroll the page content." -ForegroundColor White
Write-Host ""
Write-Host "  3. Wait ~5 seconds (DB sync debounce interval), then open DevTools Network panel." -ForegroundColor White
Write-Host ""
Write-Host "  4. Look for a POST request to syncScrollProgressAction." -ForegroundColor White
Write-Host ""
Write-Host "  5. Optional: refresh the page and verify scroll position is restored." -ForegroundColor White
Write-Host ""

Write-SafeStep "Step D: Reader page manual verification -- chapter completion sync"
Write-Host ""
Write-Host "  1. On the same chapter page, find and click 'Mark chapter as read' button." -ForegroundColor White
Write-Host ""
Write-Host "  2. Observe button state change and status message." -ForegroundColor White
Write-Host ""
Write-Host "  3. Look for a POST request to syncChapterCompletionAction." -ForegroundColor White
Write-Host ""
Write-Host "  4. Refresh the page and confirm read status persists." -ForegroundColor White
Write-Host ""

Write-SafeStep "Step E: Confirm DB writes (optional -- requires direct DB access)"
Write-Host ""
Write-Host "  If Prisma Studio is available:" -ForegroundColor White
Write-Host "    pnpm --filter @learning-agent-platform/db prisma:studio" -ForegroundColor Gray
Write-Host ""
Write-Host "  Or query with psql:" -ForegroundColor White
$sqlExample = 'SELECT * FROM "ReadingProgress" ORDER BY "updatedAt" DESC LIMIT 10;'
Write-Host "    $sqlExample" -ForegroundColor Gray
Write-Host ""
Write-Host "  Verify that ReadingProgress contains records for demo@example.com." -ForegroundColor White
Write-Host ""

Write-SafeStep "Verification Checklist"
Write-Host ""
Write-Host "  [ ] DATABASE_URL is configured" -ForegroundColor White
Write-Host "  [ ] Demo user seed has been run" -ForegroundColor White
Write-Host "  [ ] /api/dev/db-health returns ok: true" -ForegroundColor White
Write-Host "  [ ] Scroll triggers DB sync (Network panel) or safely skips" -ForegroundColor White
Write-Host "  [ ] Toggle read triggers DB sync (Network panel) or safely skips" -ForegroundColor White
Write-Host "  [ ] ReadingProgress table has new records (optional DB check)" -ForegroundColor White
Write-Host ""

# ── Security reminder ──

Write-Host "==============================================" -ForegroundColor Magenta
Write-Host " Security Reminder" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  - This script did not modify .env or .env.example." -ForegroundColor White
Write-Host "  - This script did not output DATABASE_URL." -ForegroundColor White
Write-Host "  - Reader DB sync is a dev preview feature, not production." -ForegroundColor White
Write-Host "  - DB sync failures fall back to localStorage, do not block the page." -ForegroundColor White
Write-Host "  - .env and DATABASE_URL must NOT be committed to Git." -ForegroundColor White
Write-Host ""

Write-SafeInfo "Verification script finished. Follow the manual steps above to complete verification."
