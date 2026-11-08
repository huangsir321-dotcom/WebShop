#!/usr/bin/env bash
# Starts the FORME v3 stack: PostgreSQL (if needed) + API + storefront.
#
#   Usage (Git Bash):  ./start.sh
#   Usage (CMD):       start.cmd
#
# Everything stays on the F: drive: Node/PostgreSQL binaries come from
# F:/WebShop/.toolchain, the v3 database cluster lives in F:/tools/pgdata.

set -euo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
source ./env.sh

# Read PORT / DATABASE_URL from .env (single source of truth).
# dotenv does not override variables that already exist, so these win.
eval "$(node -e '
const fs=require("fs");
let t="";
try{t=fs.readFileSync(".env","utf8");}catch(e){process.exit(0);}
for(const k of ["PORT","DATABASE_URL"]){
  const m=t.match(new RegExp("^"+k+"=(.*)$","m"));
  if(m) console.log("export "+k+"="+JSON.stringify(m[1].trim().replace(/^"|"$/g,"")));
}
')"

: "${PORT:=4100}"
: "${DATABASE_URL:=postgresql://forme:forme_dev_password@127.0.0.1:5433/forme?schema=public}"

PGDATA_DIR="F:/tools/pgdata"
PGPORT_LOCAL="5433"

echo "==> PostgreSQL"
if "$PGHOME/bin/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
  echo "    already running on port $PGPORT_LOCAL"
else
  "$PGHOME/bin/pg_ctl" -D "$PGDATA_DIR" -l "$PGDATA_DIR/server.log" \
    -o "-p $PGPORT_LOCAL -h localhost" start
  sleep 2
fi

echo "==> FORME API + storefront"
echo "    Storefront : http://localhost:$PORT"
echo "    Admin UI   : http://localhost:$PORT/admin/"
echo "    API health : http://localhost:$PORT/health"
echo
exec node server/src/index.js
