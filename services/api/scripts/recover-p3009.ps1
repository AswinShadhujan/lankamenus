# Clears Prisma P3009 for failed initial migration, then reapplies migrations.
# Usage (PowerShell): set DATABASE_URL to Railway Postgres, then:
#   cd services/api
#   .\scripts\recover-p3009.ps1
$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) {
  Write-Error 'Set DATABASE_URL first (e.g. copy from Railway Variables).'
}
Set-Location (Split-Path $PSScriptRoot -Parent)
pnpm exec prisma migrate resolve --rolled-back "20250329001000_initial_schema"
pnpm exec prisma migrate deploy
Write-Host 'Done. If deploy fails on postgis, use a Postgres with PostGIS enabled.'
