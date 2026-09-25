param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
  throw 'Installer integration tests must run on an isolated Windows GitHub runner.'
}
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$oldInstaller = Join-Path $env:RUNNER_TEMP 'Weekdeck-0.2.0-win-x64.exe'
Invoke-WebRequest 'https://github.com/Voyager162/WeekDeck/releases/download/v0.2.0/Weekdeck-0.2.0-win-x64.exe' -OutFile $oldInstaller
if ((Get-FileHash -LiteralPath $oldInstaller -Algorithm SHA256).Hash -ne '3B0ACFB1530C156CEE36C56AABC196CFA783D578C0D8ECC8B305995410FA5039') {
  throw 'Previous release checksum mismatch.'
}
function Install-And-Expect([string]$Path, [int]$Code) {
  $process = Start-Process -FilePath $Path -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne $Code) { throw "Installer exited $($process.ExitCode), expected $Code" }
}
function Get-WeekdeckInstallation {
  $entries = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' |
    Where-Object { $_.DisplayName -match '^Weekdeck(?: |$)' })
  if ($entries.Count -ne 1) { throw "Expected one Weekdeck installation, found $($entries.Count)" }
  return $entries[0]
}
Install-And-Expect $oldInstaller 0
$before = Get-WeekdeckInstallation
if ($before.DisplayVersion -ne '0.2.0') { throw 'Previous release did not install.' }
$exe = Join-Path $env:LOCALAPPDATA 'Programs\weekdeck\Weekdeck.exe'
$profile = Join-Path $env:APPDATA 'weekdeck'
New-Item -ItemType Directory -Path $profile -Force | Out-Null
$marker = Join-Path $profile 'installer-test-marker.txt'
Set-Content -LiteralPath $marker -Value 'Preserve existing user data'
Install-And-Expect $installerPath 0
$after = Get-WeekdeckInstallation
if ($after.DisplayVersion -ne $version -or $after.PSChildName -ne $before.PSChildName) {
  throw 'Upgrade did not reuse the existing installation identity.'
}
if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath $marker)) {
  throw 'Upgrade lost the installed executable or user profile.'
}
$hash = (Get-FileHash -LiteralPath $exe).Hash
$modified = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
Install-And-Expect $installerPath 1638
if ((Get-FileHash -LiteralPath $exe).Hash -ne $hash -or (Get-Item -LiteralPath $exe).LastWriteTimeUtc -ne $modified) {
  throw 'Same-version installer modified the app.'
}
if ((Get-WeekdeckInstallation).DisplayVersion -ne $version -or !(Test-Path -LiteralPath $marker)) {
  throw 'Same-version cancellation changed the installation or user profile.'
}
Write-Output 'Previous-version upgrade and same-version cancellation passed; user data preserved.'
