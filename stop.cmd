@echo off
rem Stops the FORME v3 stack.
rem Usage:  stop.cmd
rem
rem Kills only the v3 API process and the v3 PostgreSQL cluster on port 5433.
rem It does not touch the shared cluster on port 5432 or any other project.

setlocal
cd /d "%~dp0"
call env.cmd

for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
  if "%%A"=="PORT" set "PORT=%%B"
)
if "%PORT%"=="" set "PORT=4100"

echo ==^> Stopping API on port %PORT%
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty OwningProcess"`) do (
  if not "%%P"=="" (
    powershell -NoProfile -Command "Stop-Process -Id %%P -Force"
    echo     stopped PID %%P
  )
)

echo ==^> Stopping PostgreSQL ^^(v3 cluster, port 5433^)
"%PGHOME%\bin\pg_ctl.exe" -D "F:\tools\pgdata" stop -m fast
