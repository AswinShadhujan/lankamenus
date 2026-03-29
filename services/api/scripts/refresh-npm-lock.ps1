# Regenerate package-lock.json with npm without touching pnpm's node_modules layout.
# Running `npm install` in services/api when node_modules was created by pnpm can trigger:
#   npm error Cannot read properties of null (reading 'matches')
$ErrorActionPreference = "Stop"
$apiRoot = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("lankamenus-npm-lock-" + [Guid]::NewGuid().ToString("n"))
try {
  New-Item -ItemType Directory -Path $tmp | Out-Null
  Copy-Item (Join-Path $apiRoot "package.json") (Join-Path $tmp "package.json")
  Push-Location $tmp
  npm install --ignore-scripts --package-lock-only
  Copy-Item (Join-Path $tmp "package-lock.json") (Join-Path $apiRoot "package-lock.json") -Force
  Write-Host "Wrote $(Join-Path $apiRoot 'package-lock.json')"
} finally {
  Pop-Location
  if (Test-Path $tmp) {
    Remove-Item -Recurse -Force $tmp
  }
}
