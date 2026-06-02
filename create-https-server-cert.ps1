param(
    [string]$ProjectDir = "ratlive_main",
    [string]$RootCaCertPath = "C:\Users\klaus\OneDrive - HSOS\certificates\rootCA.pem.crt",
    [string]$RootCaKeyPath = "C:\Users\klaus\OneDrive - HSOS\certificates\rootCA.pem.key",
    [string]$ServerSubject = "localhost",
    [string]$PfxPassword = "Initial123!",
    [int]$ValidDays = 825
)

$ErrorActionPreference = "Stop"

function Invoke-OpenSsl {
    param([string[]]$OpenSslArgs)

    & openssl @OpenSslArgs
    if ($LASTEXITCODE -ne 0) {
        throw "OpenSSL-Fehler bei: openssl $($OpenSslArgs -join ' ')"
    }
}

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    throw "OpenSSL wurde nicht gefunden. Bitte OpenSSL installieren oder in PATH aufnehmen."
}

if (-not (Test-Path -Path $RootCaCertPath)) {
    throw "Root-CA-Zertifikat nicht gefunden: $RootCaCertPath"
}

if (-not (Test-Path -Path $RootCaKeyPath)) {
    throw "Root-CA-Key nicht gefunden: $RootCaKeyPath"
}

$projectPath = Join-Path -Path $PSScriptRoot -ChildPath $ProjectDir
if (-not (Test-Path -Path $projectPath)) {
    throw "Projektordner nicht gefunden: $projectPath"
}

$certsDir = Join-Path -Path $projectPath -ChildPath "certs"
if (-not (Test-Path -Path $certsDir)) {
    New-Item -Path $certsDir -ItemType Directory | Out-Null
}

$serverKeyPath = Join-Path -Path $certsDir -ChildPath "https-localhost.key"
$serverCsrPath = Join-Path -Path $certsDir -ChildPath "https-localhost.csr"
$serverCrtPath = Join-Path -Path $certsDir -ChildPath "https-localhost.crt"
$serverPfxPath = Join-Path -Path $certsDir -ChildPath "https-localhost.pfx"
$caCerPath = Join-Path -Path $certsDir -ChildPath "ratlive-root-ca.cer"
$caSerialPath = Join-Path -Path $certsDir -ChildPath "rootCA.srl"
$opensslCfgPath = Join-Path -Path $certsDir -ChildPath "https-localhost-openssl.cnf"
$appSettingsDevPath = Join-Path -Path $projectPath -ChildPath "appsettings.Development.json"

$cfg = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = req_dn
req_extensions = req_ext

[req_dn]
CN = $ServerSubject

[req_ext]
subjectAltName = @alt_names
extendedKeyUsage = serverAuth
keyUsage = digitalSignature, keyEncipherment

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
"@

Set-Content -Path $opensslCfgPath -Value $cfg -Encoding ascii

Invoke-OpenSsl -OpenSslArgs @("req", "-new", "-nodes", "-newkey", "rsa:2048", "-keyout", $serverKeyPath, "-out", $serverCsrPath, "-config", $opensslCfgPath)

Invoke-OpenSsl -OpenSslArgs @("x509", "-req", "-in", $serverCsrPath, "-CA", $RootCaCertPath, "-CAkey", $RootCaKeyPath, "-CAcreateserial", "-CAserial", $caSerialPath, "-out", $serverCrtPath, "-days", "$ValidDays", "-sha256", "-extfile", $opensslCfgPath, "-extensions", "req_ext")

Invoke-OpenSsl -OpenSslArgs @("pkcs12", "-export", "-out", $serverPfxPath, "-inkey", $serverKeyPath, "-in", $serverCrtPath, "-certfile", $RootCaCertPath, "-passout", "pass:$PfxPassword")

Copy-Item -Path $RootCaCertPath -Destination $caCerPath -Force

if (-not (Test-Path -Path $appSettingsDevPath)) {
    throw "Datei nicht gefunden: $appSettingsDevPath"
}

$json = Get-Content -Path $appSettingsDevPath -Raw | ConvertFrom-Json
if (-not $json.Kestrel) {
    $json | Add-Member -MemberType NoteProperty -Name Kestrel -Value ([pscustomobject]@{})
}
if (-not $json.Kestrel.Certificates) {
    $json.Kestrel | Add-Member -MemberType NoteProperty -Name Certificates -Value ([pscustomobject]@{})
}
$json.Kestrel.Certificates | Add-Member -MemberType NoteProperty -Name Default -Value ([pscustomobject]@{}) -Force
$json.Kestrel.Certificates.Default | Add-Member -MemberType NoteProperty -Name Path -Value "certs/https-localhost.pfx" -Force
$json.Kestrel.Certificates.Default | Add-Member -MemberType NoteProperty -Name Password -Value $PfxPassword -Force

($json | ConvertTo-Json -Depth 20) | Set-Content -Path $appSettingsDevPath -Encoding UTF8

Write-Host "Root-CA wird nicht importiert (bereits vorhanden laut Vorgabe)."

Write-Host ""
Write-Host "HTTPS-Serverzertifikat erstellt (signiert mit bestehender Root-CA)."
Write-Host "Root-CA cert: $RootCaCertPath"
Write-Host "Root-CA key:  $RootCaKeyPath"
Write-Host "Server PFX:   $serverPfxPath"
Write-Host "App config:   $appSettingsDevPath"
Write-Host ""
Write-Host "Start mit HTTPS-Profil:"
Write-Host "dotnet run --project .\\ratlive_main\\ratlive_main.csproj --launch-profile https"
