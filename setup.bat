@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org first.
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<12)){console.error('Node.js 22.12 or newer is required.');process.exit(1)}"
if not "%errorlevel%"=="0" exit /b 1
call npm ci
if not "%errorlevel%"=="0" (
  echo Setup failed. Stop any running Echoes dev or preview server and retry.
  exit /b 1
)
call npm test
if not "%errorlevel%"=="0" exit /b 1
call npm run build
if not "%errorlevel%"=="0" exit /b 1
echo Ready. Run run.bat to open Echoes.
exit /b 0
