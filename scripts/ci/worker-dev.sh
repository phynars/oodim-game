#!/usr/bin/env bash
# The server the aftersign e2e plays against (11-12): the REAL Worker
# (src/server.ts with its Durable Objects, run locally by `wrangler dev`),
# serving the staged build the way the deploy publishes it.
# aftersign/playwright.config.ts starts this as its webServer.
#
# Why not `vite preview` (the lane until 11-12): preview's save endpoint is a
# second implementation, it has no /player-memory, and on localhost the client
# gives every browser one shared player id. A PR could pass every e2e and fail
# on game.oodim.com (game #2739, then #2748, 11-10 and 11-11).
#
#   worker-dev.sh <port>
#
# With AFTERSIGN_RENDERED_OUT set (the CI e2e step), the build carries the
# rendered-text recorder and a sink on <port>+100 appends what it posts to that
# file. The Worker itself gets no test route.
#
# --local: no Cloudflare account or token. Durable Object storage is a
# throwaway directory, so every run starts from an empty server.
set -euo pipefail

PORT="${1:?usage: worker-dev.sh <port>}"
SINK_PORT=$((PORT + 100))

pids=()
cleanup() {
  for pid in ${pids[@]+"${pids[@]}"}; do
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

if [ -n "${AFTERSIGN_RENDERED_OUT:-}" ]; then
  # Same host name as the page (playwright.config.ts), another port.
  export AFTERSIGN_RENDERED_ENDPOINT="http://game.localhost:$SINK_PORT/"
  node scripts/rendered-text-sink.mjs "$SINK_PORT" &
  pids+=("$!")
fi

npm run build:aftersign
bash scripts/ci/stage-site.sh

state=$(mktemp -d)
WRANGLER_SEND_METRICS=false npx wrangler dev --local --ip 127.0.0.1 --port "$PORT" --persist-to "$state" &
pids+=("$!")
wait "${pids[-1]}"
