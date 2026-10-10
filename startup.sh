#!/bin/sh
set -eu
cd /workspace
node scripts/preview.mjs stop || true
sh scripts/ensure-convex-backend.sh
if ! curl -sf -o /dev/null --max-time 1 http://127.0.0.1:3210/version; then
  CONVEX_AGENT_MODE=anonymous node node_modules/convex/bin/main.js dev --typecheck disable --tail-logs disable >>/tmp/convex.log 2>&1 &
  i=0
  while [ "$i" -lt 160 ]; do
    if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:3210/version; then
      break
    fi
    i=$((i + 1))
    sleep 0.5
  done
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
