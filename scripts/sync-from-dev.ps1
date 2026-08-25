# Sync code từ kltn-app-main (dev) sang UTE-FE-KLTN (prod)
# Giữ nguyên: .env.local (credentials khach), .git (history prod), node_modules
#
# Cách dùng:
#   cd c:\UTE-FE-KLTN
#   .\scripts\sync-from-dev.ps1
#   (xem diff, commit, deploy)

$DEV_DIR  = "c:\kltn-app-main"
$PROD_DIR = "c:\UTE-FE-KLTN"

if (-not (Test-Path $DEV_DIR)) {
    Write-Host "Khong tim thay $DEV_DIR" -ForegroundColor Red
    exit 1
}

Write-Host "Syncing $DEV_DIR -> $PROD_DIR" -ForegroundColor Cyan
Write-Host "Bo qua: node_modules, .next, .git, out, .env.local, .env*.local" -ForegroundColor Gray
Write-Host ""

# /XF dùng filename-only (matches anywhere) — KHÔNG dùng path prefix
# Nếu để "scripts\file.ps1" robocopy KHÔNG match trong subfolder
$excludeFiles = @(
    ".env.local", ".env.production.local", ".env.development.local", ".env.test.local",
    ".gitignore",
    "HANDOVER.md",
    "sync-from-dev.ps1", "push-env-to-vercel.ps1",
    "get-drive-token.mjs",
    "_drive_token.tmp", "_smtp.tmp", "_env_value.tmp"
)

# /MIR: mirror (xoa file ben prod neu khong con ben dev)
# /XD: exclude directories
# /XF: exclude files (filename-only, matches anywhere)
# /NFL /NDL: bot log file/dir
# /NP: bo progress bar
robocopy $DEV_DIR $PROD_DIR /MIR `
    /XD node_modules .next .git out .vercel `
    /XF $excludeFiles `
    /NFL /NDL /NJH /NJS /NP

$exit = $LASTEXITCODE
if ($exit -ge 8) {
    Write-Host "Robocopy bao loi (exit=$exit). Dung lai." -ForegroundColor Red
    exit $exit
}

Write-Host ""
Write-Host "Sync xong. Buoc tiep theo:" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Xem nhung gi thay doi:" -ForegroundColor Yellow
Write-Host "     git -C `"$PROD_DIR`" status" -ForegroundColor White
Write-Host "     git -C `"$PROD_DIR`" diff" -ForegroundColor White
Write-Host ""
Write-Host "  2. Commit:" -ForegroundColor Yellow
Write-Host "     git -C `"$PROD_DIR`" add ." -ForegroundColor White
Write-Host "     git -C `"$PROD_DIR`" commit -m `"Sync: <mo ta thay doi>`"" -ForegroundColor White
Write-Host ""
Write-Host "  3. Deploy:" -ForegroundColor Yellow
Write-Host "     cd `"$PROD_DIR`"" -ForegroundColor White
Write-Host "     vercel deploy --prod --yes" -ForegroundColor White
