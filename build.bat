@echo off
cd /d "%~dp0"
echo Building frontend...
call npx vite build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)
echo Building Windows installer...
call npx electron-builder --win --x64
echo Done!


