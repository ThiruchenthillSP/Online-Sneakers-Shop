$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
docker compose ps
try { Invoke-RestMethod 'http://localhost:8091/api/health' | ConvertTo-Json -Compress } catch { Write-Host 'Shop health endpoint is unavailable.' }
