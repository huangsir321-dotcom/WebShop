# FORME v3 - environment script
#
# Usage (Git Bash):  source ./env.sh
# Usage (CMD):       call env.cmd
#
# Everything (Node.js, PostgreSQL, npm cache, temp files, database data) lives
# on the F: drive. Nothing is installed to or written on C:.

export TOOLCHAIN="/f/WebShop/.toolchain"
export PROJECT="F:/WebShop/forme-global-commerce-platform-v3/forme-commerce-platform"

# Toolchain binaries (POSIX form so Git Bash resolves them).
export PATH="$TOOLCHAIN/node:$TOOLCHAIN/pgsql/bin:$PATH"

# PostgreSQL locations.
export PGHOME="$TOOLCHAIN/pgsql"
export PGDATA="F:/tools/pgdata"
export PGPORT=5433
export PGHOST=127.0.0.1
export PGUSER=forme
export PGDATABASE=forme

# Keep npm's cache and all temp files off the C: drive.
export NPM_CONFIG_CACHE="$TOOLCHAIN/npm-cache"
export NPM_CONFIG_USERCONFIG="$TOOLCHAIN/npmrc"
export NPM_CONFIG_GLOBALCONFIG="$TOOLCHAIN/global-npmrc"
export TMPDIR="$TOOLCHAIN/tmp"
export TEMP="$TOOLCHAIN/tmp"
export TMP="$TOOLCHAIN/tmp"

# Prisma: skip telemetry checkpointing.
export CHECKPOINT_DISABLE=1

export PATH
