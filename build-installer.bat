@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ========================================
echo       Hesbah - Build Installer
echo ========================================
echo.
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)
echo.
echo Building Windows installer...
call npm run dist
if errorlevel 1 goto :error
echo.
echo DONE. Check the dist folder.
pause
exit /b 0
:error
echo.
echo BUILD FAILED.
pause
exit /b 1
