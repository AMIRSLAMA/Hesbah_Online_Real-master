@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ========================================
echo       Hesbah - License Generator
echo ========================================
echo.
set /p CUSTOMER=Customer name: 
set /p MACHINE=Machine ID: 
set /p DAYS=Activation days (default 365): 
if "%DAYS%"=="" set DAYS=365
node tools\create-license.js "%CUSTOMER%" "%MACHINE%" %DAYS%
echo.
pause
