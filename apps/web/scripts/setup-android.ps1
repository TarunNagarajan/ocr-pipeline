# Setup environment
$JAVA_HOME = "C:\Users\ultim\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.11.9-hotspot"
$ANDROID_HOME = "D:\tools\android"
$env:JAVA_HOME = $JAVA_HOME
$env:ANDROID_HOME = $ANDROID_HOME
$env:Path = "$JAVA_HOME\bin;$ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Write-Host "=== Java Version ==="
java -version 2>&1

Write-Host "`n=== sdkmanager Version ==="
sdkmanager --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Trying direct path..."
    & "$ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --version 2>&1
}

Write-Host "`n=== Accepting Licenses ==="
"y" * 10 | & "$ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$ANDROID_HOME --licenses 2>&1

Write-Host "`n=== Installing Platform SDK ==="
& "$ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$ANDROID_HOME "platforms;android-35" "build-tools;35.0.0" "platform-tools" 2>&1

Write-Host "`n=== SDK Status ==="
Get-ChildItem "$ANDROID_HOME\platforms" -ErrorAction SilentlyContinue | Select-Object Name
Get-ChildItem "$ANDROID_HOME\build-tools" -ErrorAction SilentlyContinue | Select-Object Name
Write-Host "Platform 35 ready: $(Test-Path $ANDROID_HOME\platforms\android-35)"

Write-Host "`n=== Installing JS Dependencies ==="
Set-Location "C:\Users\ultim\cystar\apps\web"
npm install 2>&1 | Select-Object -Last 5

Write-Host "`n=== Building Next.js App ==="
$env:BUILD_TARGET = "capacitor"
npx next build 2>&1 | Select-Object -Last 10

Write-Host "`n=== Checking Output ==="
if (Test-Path "out\index.html") {
    Write-Host "Static export built successfully!"
} else {
    Write-Host "Checking out directory..."
    Get-ChildItem "out" -ErrorAction SilentlyContinue | Select-Object Name
}

Write-Host "`n=== Capacitor Sync ==="
npx cap sync android 2>&1

Write-Host "`n=== Building APK with Gradle ==="
Set-Location "android"
.\gradlew.bat assembleRelease 2>&1 | Select-Object -Last 30

Write-Host "`n=== APK Results ==="
$apk = Get-ChildItem -Recurse -Filter "*.apk" -Path "." -ErrorAction SilentlyContinue
if ($apk) {
    Write-Host "APK FOUND:"
    $apk | Select-Object FullName, Length | Format-Table -AutoSize
} else {
    Write-Host "No APK found."
    Get-ChildItem -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue | Select-Object FullName
}
Write-Host "`nDone!"
