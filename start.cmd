@echo off
rem Starts the FORME v3 stack: PostgreSQL (if needed) + API + storefront.
rem Usage:  start.cmd
rem
rem Everything stays on the F: drive.

setlocal
cd /d "%~dp0"
call env.cmd

rem Read PORT / DATABASE_URL from .env (single source of truth).
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
  if "%%A"=="PORT" set "PORT=%%B"
  if "%%A"=="DATABASE_URL" set "DATABASE_URL=%%B"
)
if "%PORT%"=="" set "PORT=4100"
if "%DATABASE_URL%"=="" set "DATABASE_URL=postgresql://forme:forme_dev_password@127.0.0.1:5433/forme?schema=public"

set "PGDATA_DIR=F:\tools\pgdata"

echo ==^> PostgreSQL
"%PGHOME%\bin\pg_ctl.exe" -D "%PGDATA_DIR%" status >nul 2>&1
if errorlevel 1 (
  "%PGHOME%\bin\pg_ctl.exe" -D "%PGDATA_DIR%" -l "%PGDATA_DIR%\server.log" -o "-p 5433 -h localhost" start
  timeout /t 2 /nobreak >nul
) else (
  echo     already running on port 5433
)

echo ==^> FORME API + storefront
echo     Storefront : http://localhost:%PORT%
echo     Admin UI   : http://localhost:%PORT%/admin/
echo     API health : http://localhost:%PORT%/health
echo.
node server\src\index.js
