param(
    [string]$CommonName = "rat1",
    [string]$OutputDir = "cert_output",
    [string]$CaSubject = "CN=RatLive Local Root CA",
    [int]$LeafValidYears = 2,
    [int]$CaValidYears = 10,
    [string]$PfxPassword = "Initial123!"
)

$ErrorActionPreference = "Stop"

function Get-OrCreate-LocalCa {
    param(
        [string]$Subject,
        [int]$ValidYears
    )

    $existing = Get-ChildItem -Path Cert:\CurrentUser\My |
        Where-Object { $_.Subject -eq $Subject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1

    if ($existing) {
        Write-Host "Verwende vorhandene lokale CA: $($existing.Thumbprint)"
        return $existing
    }

    Write-Host "Erzeuge neue lokale CA: $Subject"

    $ca = New-SelfSignedCertificate \
        -Subject $Subject \
        -Type Custom \
        -KeyAlgorithm RSA \
        -KeyLength 4096 \
        -HashAlgorithm sha256 \
        -KeyExportPolicy Exportable \
        -KeyUsageProperty Sign \
        -KeyUsage CertSign, CRLSign, DigitalSignature \
        -TextExtension @(
            "2.5.29.19={critical}{text}ca=true&pathlength=1",
            "2.5.29.37={text}1.3.6.1.5.5.7.3.3"
        ) \
        -NotAfter (Get-Date).AddYears($ValidYears) \
        -CertStoreLocation "Cert:\CurrentUser\My"

    return $ca
}

function New-SignedUserCertificate {
    param(
        [string]$SubjectCn,
        [System.Security.Cryptography.X509Certificates.X509Certificate2]$SignerCa,
        [int]$ValidYears
    )

    Write-Host "Erzeuge signiertes Benutzerzertifikat fuer CN=$SubjectCn"

    $cert = New-SelfSignedCertificate \
        -Subject "CN=$SubjectCn" \
        -Type Custom \
        -Signer $SignerCa \
        -KeyAlgorithm RSA \
        -KeyLength 2048 \
        -HashAlgorithm sha256 \
        -KeyExportPolicy Exportable \
        -KeyUsage DigitalSignature, KeyEncipherment \
        -TextExtension @(
            "2.5.29.19={critical}{text}ca=false",
            "2.5.29.37={text}1.3.6.1.5.5.7.3.2"
        ) \
        -NotAfter (Get-Date).AddYears($ValidYears) \
        -CertStoreLocation "Cert:\CurrentUser\My"

    return $cert
}

$resolvedOutputDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir
} else {
    Join-Path -Path $PSScriptRoot -ChildPath $OutputDir
}

if (-not (Test-Path -Path $resolvedOutputDir)) {
    New-Item -Path $resolvedOutputDir -ItemType Directory | Out-Null
}

$ca = Get-OrCreate-LocalCa -Subject $CaSubject -ValidYears $CaValidYears
$userCert = New-SignedUserCertificate -SubjectCn $CommonName -SignerCa $ca -ValidYears $LeafValidYears

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$safeName = ($CommonName -replace "[^a-zA-Z0-9_-]", "_")

$pfxPath = Join-Path $resolvedOutputDir "$safeName`_$timestamp.pfx"
$cerPath = Join-Path $resolvedOutputDir "$safeName`_$timestamp.cer"
$caCerPath = Join-Path $resolvedOutputDir "ratlive_root_ca.cer"

$securePassword = ConvertTo-SecureString -String $PfxPassword -AsPlainText -Force
Export-PfxCertificate -Cert $userCert -FilePath $pfxPath -Password $securePassword | Out-Null
Export-Certificate -Cert $userCert -FilePath $cerPath | Out-Null
Export-Certificate -Cert $ca -FilePath $caCerPath | Out-Null

Write-Host ""
Write-Host "Zertifikatserstellung abgeschlossen."
Write-Host "Benutzerzertifikat (PFX): $pfxPath"
Write-Host "Benutzerzertifikat (CER): $cerPath"
Write-Host "Root-CA (CER):           $caCerPath"
Write-Host "PFX-Passwort:            $PfxPassword"
