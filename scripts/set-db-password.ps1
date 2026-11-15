# Prompts for the database password (hidden) and writes the Supabase
# transaction/session pooler URLs into .env. Never prints the password.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

if (-not (Test-Path -LiteralPath $envPath)) {
  throw ".env not found at $envPath"
}

$supabaseUrlLine = Select-String -LiteralPath $envPath -Pattern '^SUPABASE_URL=(.+)$' | Select-Object -First 1
if (-not $supabaseUrlLine) {
  throw "SUPABASE_URL is not set in .env"
}
$supabaseUrl = $supabaseUrlLine.Matches[0].Groups[1].Value.Trim()
$ref = ([Uri]$supabaseUrl).Host.Split('.')[0]

$secure = Read-Host "Database password (input hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($plain)) {
  throw "Empty password"
}

$poolerHost = "aws-0-us-east-1.pooler.supabase.com"
$user = "postgres.$ref"
$encodedPassword = [Uri]::EscapeDataString($plain)

$databaseUrl = "postgresql://${user}:${encodedPassword}@${poolerHost}:6543/postgres?pgbouncer=true"
$directUrl = "postgresql://${user}:${encodedPassword}@${poolerHost}:5432/postgres"

$lines = Get-Content -LiteralPath $envPath
$hasDatabaseUrl = $false
$hasDirectUrl = $false

$updated = foreach ($line in $lines) {
  if ($line -match '^DATABASE_URL=') {
    $hasDatabaseUrl = $true
    "DATABASE_URL=$databaseUrl"
  } elseif ($line -match '^DIRECT_URL=') {
    $hasDirectUrl = $true
    "DIRECT_URL=$directUrl"
  } else {
    $line
  }
}

if (-not $hasDatabaseUrl) { $updated += "DATABASE_URL=$databaseUrl" }
if (-not $hasDirectUrl) { $updated += "DIRECT_URL=$directUrl" }

[System.IO.File]::WriteAllLines($envPath, [string[]]$updated, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Updated DATABASE_URL (6543) and DIRECT_URL (5432) for project $ref."
