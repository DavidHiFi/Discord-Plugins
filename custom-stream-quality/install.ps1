# Installs Custom Stream Quality into a TestCord source checkout and rebuilds it.
# Usage: .\install.ps1 -TestCord "C:\path\to\TestCord" [-NoBuild]
param(
    [Parameter(Mandatory)] [string] $TestCord,
    [switch] $NoBuild
)
$ErrorActionPreference = "Stop"

$target = Join-Path $TestCord "src\testcordplugins\StreamQuality"
if (-not (Test-Path (Join-Path $TestCord "package.json"))) { throw "No TestCord checkout at $TestCord" }

if (Test-Path $target) {
    $backup = "$target.backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item $target $backup -Recurse
    Write-Host "Backed up the existing plugin to $backup"
} else {
    New-Item -ItemType Directory $target | Out-Null
}

$src = Join-Path $PSScriptRoot "src"
Copy-Item (Join-Path $src "index.tsx"), (Join-Path $src "quality.ts"), (Join-Path $src "patches.ts") $target -Force
Write-Host "Copied the plugin to $target"

if (-not $NoBuild) {
    Push-Location $TestCord
    try { pnpm build } finally { Pop-Location }
    Write-Host "Built. Fully quit Discord (tray icon, Quit Discord) and start it again to load the new bundle."
}
