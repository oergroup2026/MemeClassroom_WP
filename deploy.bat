@echo off
echo ===================================================
echo   MemeClassroom - Build and Deploy to Firebase
echo ===================================================
echo.

:: 1. Check if user is logged into Firebase
echo [1/3] Checking Firebase authentication status...
call npx firebase-tools login
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Firebase login failed or was cancelled.
    pause
    exit /b %ERRORLEVEL%
)

:: 2. Build Vite production app
echo.
echo [2/3] Building the production application (Vite)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Vite build failed! Deployment aborted.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Deploy hosting, security rules, and cloud functions
echo.
echo [3/3] Deploying Hosting, Rules, and Cloud Functions...
call npx firebase-tools deploy --only hosting,firestore:rules,storage,functions
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
