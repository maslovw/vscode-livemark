param(
    [Alias('i')]
    [switch]$InstallOnly
)

$ErrorActionPreference = 'Stop'

$pkg = Get-Content package.json | ConvertFrom-Json
$vsix = "$($pkg.name)-$($pkg.version).vsix"

if (-not $InstallOnly) {
    Write-Host "=== Building extension ===" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    # Re-read version after build (which bumps the version)
    $pkg = Get-Content package.json | ConvertFrom-Json
    $vsix = "$($pkg.name)-$($pkg.version).vsix"
} else {
    Write-Host "=== Skipping build ===" -ForegroundColor Yellow
}

Write-Host "=== Packaging $vsix ===" -ForegroundColor Cyan
npm run package -- --allow-missing-repository
if ($LASTEXITCODE -ne 0) { throw "Package failed" }

Write-Host "=== Installing $vsix ===" -ForegroundColor Cyan
code --install-extension $vsix --force
if ($LASTEXITCODE -ne 0) { throw "Install failed" }

Write-Host "=== Done! Reload VS Code to use the updated extension. ===" -ForegroundColor Green
