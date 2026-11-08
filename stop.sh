#!/usr/bin/env bash
# Stops the FORME v3 stack.
#
#   Usage (Git Bash):  ./stop.sh
#   Usage (CMD):       stop.cmd
#
# Kills only the v3 API process and the v3 PostgreSQL cluster on port 5433.
# It does not touch the shared cluster on port 5432 or any other project.

set -uo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
source ./env.sh

PGDATA_DIR="F:/tools/pgdata"
PORT="${PORT:-4100}"

echo "==> Stopping API on port $PORT"
PID="$(powershell -NoProfile -Command "
  Get-NetTCPConnection -State Listen -LocalPort $PORT -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
" 2>/dev/null | tr -d '\r\n ')"

if [ -n "$PID" ]; then
  powershell -NoProfile -Command "Stop-Process -Id $PID -Force" 2>/dev/null
  echo "    stopped PID $PID"
else
  echo "    nothing listening on $PORT"
fi

echo "==> Stopping PostgreSQL (v3 cluster, port 5433)"
"$PGHOME/bin/pg_ctl" -D "$PGDATA_DIR" stop -m fast 2>/dev/null \
  && echo "    stopped" \
  || echo "    not running"
