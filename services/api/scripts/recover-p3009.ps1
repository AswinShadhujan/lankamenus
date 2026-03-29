# Clears Prisma P3009/P3018 when _prisma_migrations already exists, then migrate deploy.
# Skip this script for a brand-new empty DB — use: pnpm run prisma:migrate only.
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
Write-Host 'Done. Railway default Postgres has NO PostGIS — use https://railway.com/template/postgis and set DATABASE_URL to that service, then run this script again.'
