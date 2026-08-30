@echo off
echo ===================================================
echo   MemeClassroom - Building and Deploying to Firebase
echo ===================================================
echo.

:: Check if user is logged into Firebase
echo [1/3] Checking Firebase authentication status...
call npx firebase-tools login

echo.
echo [2/3] Building the production application (Vite)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Vite build failed! Deployment aborted.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Deploying build output and Firestore/Storage configurations to Firebase...
call npx firebase-tools deploy
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Firebase deployment failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   SUCCESS! Your app is live at:
echo   https://memeclassroom-98d2b.web.app/
echo ===================================================
echo.
pause
