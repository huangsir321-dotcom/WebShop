@echo off
rem FORME v3 - environment script (Windows CMD)
rem Usage:  call env.cmd
rem
rem Everything (Node.js, PostgreSQL, npm cache, temp files, database data) lives
rem on the F: drive. Nothing is installed to or written on C:.

set "TOOLCHAIN=F:\WebShop\.toolchain"
set "PROJECT=F:\WebShop\forme-global-commerce-platform-v3\forme-commerce-platform"
set "PATH=%TOOLCHAIN%\node;%TOOLCHAIN%\pgsql\bin;%PATH%"

rem PostgreSQL locations.
set "PGHOME=%TOOLCHAIN%\pgsql"
set "PGDATA=F:\tools\pgdata"
set "PGPORT=5433"
set "PGHOST=127.0.0.1"
set "PGUSER=forme"
set "PGDATABASE=forme"

rem Keep npm's cache and all temp files off the C: drive.
set "NPM_CONFIG_CACHE=%TOOLCHAIN%\npm-cache"
set "NPM_CONFIG_USERCONFIG=%TOOLCHAIN%\npmrc"
set "NPM_CONFIG_GLOBALCONFIG=%TOOLCHAIN%\global-npmrc"
set "TMPDIR=%TOOLCHAIN%\tmp"
set "TEMP=%TOOLCHAIN%\tmp"
set "TMP=%TOOLCHAIN%\tmp"

rem Prisma: skip telemetry checkpointing.
set "CHECKPOINT_DISABLE=1"
