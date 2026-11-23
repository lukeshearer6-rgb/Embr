#!/bin/sh
# Rebuild the local test database (local testing only)
D="$(dirname "$0")/.."
P="psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists embr with (force)" -c "create database embr" >/dev/null 2>&1
$P -d embr -f "$D/tests/supabase_stub.sql" 2>&1 | grep -v NOTICE || true
for f in "$D"/supabase/migrations/*.sql; do
  $P -d embr -f "$f" 2>&1 | grep -v NOTICE || true
done
