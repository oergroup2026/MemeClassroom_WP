@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   MemeClassroom - Build & Deploy to Firebase
echo ===================================================
echo.

:: 1. Firebase Login Check
echo [1/3] Ensuring Firebase authentication...
call firebase login
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Firebase login failed or was cancelled.
    pause
    exit /b %ERRORLEVEL%
)

:: 2. Production Build
echo.
echo [2/3] Building production assets (Vite)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Vite build failed! Deployment aborted.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Deploy everything
echo.
echo [3/3] Deploying Hosting, Rules (Firestore & Storage), and Cloud Functions...
call firebase deploy --only hosting,firestore:rules,storage,functions
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Firebase deployment failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   SUCCESS! Deployment Complete!
echo   Your live app: https://memeclassroom-98d2b.web.app/
echo ===================================================
echo.
pause
