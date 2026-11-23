#!/bin/sh
# Rebuild the local test database (local testing only)
P="psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists embr" -c "create database embr" >/dev/null 2>&1
$P -d embr -f "$(dirname "$0")/../tests/supabase_stub.sql" 2>&1 | grep -v NOTICE || true
$P -d embr -f "$(dirname "$0")/../supabase/migrations/20261123000001_embr_pilot.sql" 2>&1 | grep -v NOTICE || true
