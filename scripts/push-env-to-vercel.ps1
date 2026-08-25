# Push tất cả env từ .env.local lên Vercel
# Dùng temp file + cmd stdin redirect để GUARANTEE không có BOM/whitespace

$envFile = Join-Path $PSScriptRoot "..\.env.local"
$lines = Get-Content $envFile -Raw -Encoding UTF8

function Set-VercelEnv {
    param([string]$Key, [string]$Value, [string]$Env)
    $tmp = Join-Path $PSScriptRoot "_env_value.tmp"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    [System.IO.File]::WriteAllBytes($tmp, $bytes)

    $null = & vercel.cmd env rm $Key $Env --yes 2>&1
    $null = cmd /c "vercel.cmd env add $Key $Env < `"$tmp`"" 2>&1

    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

$pairs = @()
foreach ($line in $lines -split "`n") {
    $line = $line.TrimEnd("`r", "`n", " ", "`t")
    if ($line -eq "" -or $line.StartsWith("#")) { continue }
    $eqIdx = $line.IndexOf("=")
    if ($eqIdx -lt 1) { continue }
    $key = $line.Substring(0, $eqIdx).Trim()
    $val = $line.Substring($eqIdx + 1)
    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
        $val = $val.Substring(1, $val.Length - 2)
    }
    $val = $val.Trim()
    if ($val -eq "") {
        Write-Host "  SKIP (empty): $key" -ForegroundColor Yellow
        continue
    }
    $pairs += [PSCustomObject]@{ Key = $key; Value = $val }
}

Write-Host "Pushing $($pairs.Count) env vars to Vercel (clean, no BOM)..." -ForegroundColor Cyan

foreach ($p in $pairs) {
    Set-VercelEnv -Key $p.Key -Value $p.Value -Env "production"
    Set-VercelEnv -Key $p.Key -Value $p.Value -Env "development"
    Write-Host "  OK: $($p.Key)" -ForegroundColor Green
}

Write-Host "Done. Verify with: vercel env pull" -ForegroundColor Cyan
