@echo off
REM ============================================================
REM  ABAP Inspector — BTP Cloud Foundry Deployment Script
REM  Target: https://api.cf.eu10-005.hana.ondemand.com
REM ============================================================

SET CF=C:\Users\arun.kumar9\AppData\Roaming\Cloud Foundry\cf8.exe
SET PROJECT=C:\Users\arun.kumar9\Downloads\ABAPInspector\ABAPInspector

echo.
echo ============================================================
echo  ABAP Inspector - BTP Deployment
echo  API: https://api.cf.eu10-005.hana.ondemand.com
echo ============================================================
echo.

REM --- Step 1: Verify CF CLI ---
echo [1/6] Checking CF CLI...
"%CF%" --version
IF ERRORLEVEL 1 (
    echo ERROR: CF CLI not found at %CF%
    pause
    exit /b 1
)
echo CF CLI OK.
echo.

REM --- Step 2: Login ---
echo [2/6] Logging in to BTP Cloud Foundry...
echo       API: https://api.cf.eu10-005.hana.ondemand.com
echo.
"%CF%" login -a https://api.cf.eu10-005.hana.ondemand.com
IF ERRORLEVEL 1 (
    echo ERROR: Login failed. Check your BTP credentials.
    pause
    exit /b 1
)
echo Login successful.
echo.

REM --- Step 3: Create CF Services (ignore errors if already exist) ---
echo [3/6] Creating CF service instances (skip if already exist)...
"%CF%" create-service connectivity lite abap-inspector-connectivity
"%CF%" create-service destination lite destination-service
echo Services ready.
echo.

REM --- Step 4: Build the React frontend ---
echo [4/6] Building React frontend (npm run build)...
cd /d "%PROJECT%"
call npm run build
IF ERRORLEVEL 1 (
    echo ERROR: npm build failed. Check Node.js is installed (node --version).
    pause
    exit /b 1
)
echo Build successful.
echo.

REM --- Step 5: Push to BTP ---
echo [5/6] Pushing app to BTP (cf push)...
"%CF%" push
IF ERRORLEVEL 1 (
    echo ERROR: cf push failed. Check manifest.yml and logs below.
    "%CF%" logs abap-inspector --recent
    pause
    exit /b 1
)
echo.

REM --- Step 6: Verify ---
echo [6/6] Verifying deployment...
"%CF%" apps
echo.
echo ============================================================
echo  Deployment complete!
echo  Open: https://abap-inspector.cfapps.eu10-005.hana.ondemand.com
echo ============================================================
echo.
pause
