# ============================================================
#  ABAP Inspector — BTP Cloud Foundry Deployment Script
#  Run this in a NEW PowerShell window (Run as Administrator)
# ============================================================

$CF      = "C:\cf\cf.exe"
$PROJECT = "C:\Users\arun.kumar9\Downloads\ABAPInspector\ABAPInspector"
$API     = "https://api.cf.eu10-005.hana.ondemand.com"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ABAP Inspector - BTP Cloud Foundry Deployment" -ForegroundColor Cyan
Write-Host "  API: $API" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Set API endpoint ─────────────────────────────────────────────────
Write-Host "[1/6] Setting CF API endpoint..." -ForegroundColor Yellow
& $CF api $API
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Could not reach BTP API." -ForegroundColor Red; pause; exit 1 }

# ── Step 2: Login ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/6] Logging in to BTP Cloud Foundry..." -ForegroundColor Yellow
Write-Host "      Enter your BTP email and password when prompted." -ForegroundColor Gray
& $CF login
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Login failed." -ForegroundColor Red; pause; exit 1 }

# ── Step 3: Create CF Services ───────────────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Creating CF service instances..." -ForegroundColor Yellow
& $CF create-service connectivity lite abap-inspector-connectivity
& $CF create-service destination   lite destination-service
Write-Host "Services ready (errors above are OK if they already exist)." -ForegroundColor Gray

# ── Step 4: Build React frontend ─────────────────────────────────────────────
Write-Host ""
Write-Host "[4/6] Building React frontend..." -ForegroundColor Yellow
Set-Location $PROJECT
npx vite build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Build failed." -ForegroundColor Red; pause; exit 1 }
Write-Host "Build successful." -ForegroundColor Green

# ── Step 5: CF Push ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Pushing app to BTP (cf push)..." -ForegroundColor Yellow
Write-Host "      This may take 2-5 minutes..." -ForegroundColor Gray
& $CF push
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: cf push failed. Fetching recent logs..." -ForegroundColor Red
    & $CF logs abap-inspector --recent
    pause; exit 1
}

# ── Step 6: Verify ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Verifying deployment..." -ForegroundColor Yellow
& $CF apps

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Deployment COMPLETE!" -ForegroundColor Green
Write-Host "  App URL: https://abap-inspector.cfapps.eu10-005.hana.ondemand.com" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
pause
