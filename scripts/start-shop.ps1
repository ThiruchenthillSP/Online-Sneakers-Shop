param([switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Test-Path '.env')) {
    Write-Host 'Create .env from .env.example and set ADMIN_PASSWORD before starting.'
    exit 1
}
if ($Build) { docker compose up -d --build } else { docker compose up -d }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose ps
Write-Host 'Open http://localhost:8091'
