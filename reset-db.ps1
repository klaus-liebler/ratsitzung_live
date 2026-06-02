param(
    [string]$ProjectDir = "ratlive_main"
)

$ErrorActionPreference = "Stop"

$projectPath = Join-Path -Path $PSScriptRoot -ChildPath $ProjectDir
$appSettingsPath = Join-Path -Path $projectPath -ChildPath "appsettings.json"

if (-not (Test-Path -Path $appSettingsPath)) {
    throw "appsettings.json nicht gefunden: $appSettingsPath"
}

$appSettings = Get-Content -Path $appSettingsPath -Raw | ConvertFrom-Json
$dbRelPath = [string]$appSettings.Database.Path

if ([string]::IsNullOrWhiteSpace($dbRelPath)) {
    throw "Database.Path ist in appsettings.json nicht gesetzt."
}

$dbPath = if ([System.IO.Path]::IsPathRooted($dbRelPath)) {
    $dbRelPath
} else {
    Join-Path -Path $projectPath -ChildPath $dbRelPath
}

$toDelete = @(
    $dbPath,
    "$dbPath-wal",
    "$dbPath-shm",
    "$dbPath-journal"
)

foreach ($path in $toDelete) {
    if (Test-Path -Path $path) {
        Remove-Item -Path $path -Force
        Write-Host "Geloescht: $path"
    }
}

Write-Host ""
Write-Host "DB-Reset abgeschlossen."
Write-Host "Beim naechsten Start von ratlive_main wird die Datenbank aus sqlite_ddl_v1.sql + sqlite_seed_v1.sql neu aufgebaut."