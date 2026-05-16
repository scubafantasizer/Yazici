@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo.
echo   Yazıcı v3.0.0
echo.

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  npx tsx src/server.ts
) else (
  call npm run build
  node dist/server.js
)
