@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ========================================
echo          Hesbah - Build Installer
echo ========================================
echo.
if not exist node_modules (
  echo [1/2] Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
)
echo.
echo [2/2] Building Hesbah installer...
call npm run dist
if errorlevel 1 goto :error
echo.
echo ========================================
echo DONE
echo Check the dist folder.
echo ========================================
pause
exit /b 0
:error
echo.
echo BUILD FAILED. Review the message above.
pause
exit /b 1
