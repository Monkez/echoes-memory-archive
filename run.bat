@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\vite" (
  call setup.bat
  if errorlevel 1 exit /b 1
)
call npm run dev -- --open
exit /b %errorlevel%
