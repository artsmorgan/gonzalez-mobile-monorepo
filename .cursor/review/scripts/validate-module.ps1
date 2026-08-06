# Validación post-fix por módulo — test-soft-001
param(
  [Parameter(Mandatory = $true)]
  [string]$ModuleId
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $Root

Write-Host "=== validate-module: $ModuleId ===" -ForegroundColor Cyan

$manifestPath = ".cursor/review/modules-manifest.json"
if (-not (Test-Path $manifestPath)) {
  Write-Host "ERROR: falta modules-manifest.json" -ForegroundColor Red
  exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$mod = $manifest.modules | Where-Object { $_.id -eq $ModuleId }
if (-not $mod) {
  Write-Host "WARN: módulo '$ModuleId' no encontrado en manifiesto" -ForegroundColor Yellow
}

Write-Host "`n--- TypeScript mobile ---" -ForegroundColor Yellow
Push-Location apps/mobile
npx tsc --noEmit
$mobileTsc = $LASTEXITCODE
Pop-Location

Write-Host "`n--- ESLint mobile ---" -ForegroundColor Yellow
Push-Location apps/mobile
npm run lint
$mobileLint = $LASTEXITCODE
Pop-Location

Write-Host "`n--- TypeScript server ---" -ForegroundColor Yellow
Push-Location apps/server
npx tsc --noEmit
$serverTsc = $LASTEXITCODE
Pop-Location

Write-Host "`n--- Resumen ---" -ForegroundColor Cyan
Write-Host "mobile tsc: $mobileTsc | mobile lint: $mobileLint | server tsc: $serverTsc"

if ($mobileTsc -ne 0 -or $mobileLint -ne 0 -or $serverTsc -ne 0) {
  Write-Host "FAIL: corregir errores antes de marcar finding como fixed" -ForegroundColor Red
  exit 1
}

Write-Host "PASS: validaciones OK para módulo $ModuleId" -ForegroundColor Green
exit 0
