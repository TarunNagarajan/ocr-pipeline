<#
.SYNOPSIS
Build Android APK for Credential Lens on Windows using Flutter + Android SDK.

.DESCRIPTION
1. Static-export the Next.js app for Capacitor
2. Sync web assets to the Android project
3. Build the release (or debug) APK via Gradle

.PARAMETER Mode
Build mode: "release" (default) or "debug"

.EXAMPLE
.\scripts\build-android.ps1
.\scripts\build-android.ps1 -Mode debug
#>

param(
  [ValidateSet("release", "debug")]
  [string]$Mode = "release"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

# ── Auto-detect Flutter + Android SDK ──
$FlutterPaths = @(
  "$env:USERPROFILE\flutter\bin",
  "$env:LOCALAPPDATA\flutter\bin",
  "C:\flutter\bin",
  "$env:PROGRAMFILES\flutter\bin"
)

$AndroidSdkPaths = @(
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:USERPROFILE\Android\Sdk",
  "$env:ANDROID_HOME",
  "C:\Android\Sdk",
  "$env:PROGRAMFILES\Android\Sdk"
)

$FlutterBin = $null
foreach ($p in $FlutterPaths) {
  if (Test-Path "$p\flutter.bat") { $FlutterBin = $p; break }
}

$AndroidSdk = $null
foreach ($p in $AndroidSdkPaths) {
  if ($p -and (Test-Path "$p\platforms")) { $AndroidSdk = $p; break }
}

if (-not $FlutterBin) { Write-Error "Flutter SDK not found. Install from https://flutter.dev/docs/get-started/install/windows"; exit 1 }
if (-not $AndroidSdk) { Write-Error "Android SDK not found. Install via Android Studio or set ANDROID_HOME."; exit 1 }

$env:PATH = "$FlutterBin;$env:PATH"
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk

Write-Host "✓ Flutter SDK: $FlutterBin" -ForegroundColor Green
Write-Host "✓ Android SDK: $AndroidSdk" -ForegroundColor Green

# ── 1. Static-export Next.js ──
Write-Host "`n── Building Next.js for Capacitor (static export) ──" -ForegroundColor Cyan
if (-not $env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL = "https://credential-lens-api-54011184572.asia-south1.run.app" }
$env:BUILD_TARGET = "capacitor"
npx next build
if ($LASTEXITCODE -ne 0) { Write-Error "Next.js build failed"; exit 1 }

# ── 2. Sync with Capacitor ──
Write-Host "`n── Syncing web assets to Capacitor Android project ──" -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "Capacitor sync failed"; exit 1 }

# ── 3. Build APK ──
Write-Host "`n── Building Android APK ($Mode) ──" -ForegroundColor Cyan
Set-Location android
if ($Mode -eq "release") {
  .\gradlew.bat assembleRelease
} else {
  .\gradlew.bat assembleDebug
}
if ($LASTEXITCODE -ne 0) { Write-Error "Gradle build failed"; exit 1 }
Set-Location $ProjectRoot

Write-Host "`n✓ APK generated at: android\app\build\outputs\apk\$Mode\app-$Mode.apk" -ForegroundColor Green
Write-Host "`n── Done ──" -ForegroundColor Cyan
