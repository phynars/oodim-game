#!/usr/bin/env bash
# Pre-merge served check (11-11). Plays the PR against the REAL Worker
# (src/server.ts with its Durable Objects, run locally by `wrangler dev`),
# serving the same staged build the deploy publishes.
#
# Why: the aftersign e2e lane runs against `vite preview`, whose save endpoint
# is a second implementation (aftersign/vite.config.ts) and which has no
# /player-memory route. The deployed Worker has both, backed by Durable
# Objects. A change could pass every PR check and fail on game.oodim.com:
# game #2739 (11-10), then its fix #2748, which also broke the post-deploy
# smoke and kept the deploy red for 8 h (11-11). The same failures reproduce
# against a local `wrangler dev` in under a minute, so the check moves here,
# before the merge. The post-deploy smoke and served replay stay as they are.
#
#   served-worker.sh          on a PR: decide from the changed files, then run
#   served-worker.sh --all    run the smoke and every spec named after --all
#                             (local use: bash scripts/ci/served-worker.sh --all aftersign/e2e/x.spec.ts)
#
# What runs, against http://127.0.0.1:$PORT:
#   1. the prod smoke (e2e-shared/prod-smoke), the suite the deploy runs after
#      publishing;
#   2. the served specs the PR added or changed (scripts/served-replay.mjs
#      plan, the list the post-deploy replay will run on the live site).
# Nothing runs when the PR touches no game, Worker or served-spec file.
#
# Env: GITHUB_EVENT_PATH (the PR event; its base sha), SERVED_WORKER_PORT.
set -euo pipefail

PORT="${SERVED_WORKER_PORT:-8788}"
# The probes below use the loopback address. The tests use a hostname that is
# NOT in the client's local-host list (aftersign/src/playerIdentity.ts): on
# localhost / 127.0.0.1 the client gives every browser the one legacy id
# `local-slice-player`, while a visitor of game.oodim.com gets an id minted
# per browser and kept in localStorage. Under the legacy id the per-visitor
# save and player-memory paths are never exercised (the smoke's identity test
# fails outright). `*.localhost` is loopback and a secure context in Chromium.
PROBE_URL="http://127.0.0.1:$PORT"
SERVED_HOST="${SERVED_WORKER_HOST:-game.localhost}"
BASE_URL="http://$SERVED_HOST:$PORT"
# Files whose change can alter what the Worker serves or how it answers.
SERVED_PATHS='^(aftersign/|apps/web/src/aftersign/|packages/|landing/|src/server\.ts$|wrangler\.jsonc$|e2e-shared/prod-smoke/|scripts/served-replay\.mjs$|scripts/ci/(served-worker|stage-site)\.sh$|package(-lock)?\.json$)'

specs=$(mktemp)
if [ "${1:-}" = "--all" ]; then
  shift
  printf '%s\n' "$@" | sed '/^$/d' > "$specs"
else
  base=""
  if [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "$GITHUB_EVENT_PATH" ]; then
    base=$(node -e 'const e=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(e.pull_request?.base?.sha??"")' "$GITHUB_EVENT_PATH")
  fi
  if [ -z "$base" ]; then
    echo "served-worker: no PR base in the event; nothing to check"
    exit 0
  fi
  changed=$(mktemp)
  git diff --name-only --diff-filter=AMR "$base...HEAD" > "$changed"
  node scripts/served-replay.mjs plan "$changed" > "$specs"
  touched=$(grep -c -E "$SERVED_PATHS" "$changed" || true)
  if [ ! -s "$specs" ] && [ "$touched" = 0 ]; then
    echo "served-worker: this PR changes no game, Worker or served-spec file; nothing to check"
    exit 0
  fi
  echo "served-worker: $touched changed file(s) can alter the served site; served specs changed by this PR:"
  cat "$specs"
  npm install
  node scripts/install-playwright-chromium.mjs
fi

npm run build
bash scripts/ci/stage-site.sh

state=$(mktemp -d)
log=$(mktemp)
# --local: no Cloudflare account or token; Durable Object storage is a
# throwaway directory, so every run starts from an empty server.
WRANGLER_SEND_METRICS=false npx wrangler dev --local --ip 127.0.0.1 --port "$PORT" --persist-to "$state" > "$log" 2>&1 &
worker=$!
# npx starts wrangler, which starts workerd: stop the children too, so a
# local run leaves no server holding public/ or the port.
trap 'pkill -P "$worker" 2>/dev/null || true; kill "$worker" 2>/dev/null || true' EXIT

ready=0
for _ in $(seq 1 60); do
  if ! kill -0 "$worker" 2>/dev/null; then break; fi
  code=$(curl -s -o /dev/null -w '%{http_code}' "$PROBE_URL/aftersign/" || true)
  if [ "$code" = 200 ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo "::error::served-worker: the local Worker did not answer on $PROBE_URL/aftersign/"
  tail -40 "$log"
  exit 1
fi
# The two routes the preview server does not have the real versions of.
memory=$(curl -s -o /dev/null -w '%{http_code}' -H 'x-player-id: served-worker-probe' "$PROBE_URL/player-memory" || true)
if [ "$memory" != 200 ]; then
  echo "::error::served-worker: GET /player-memory answered $memory on the local Worker (expected 200)"
  tail -40 "$log"
  exit 1
fi
# Playwright's request fixture resolves the name through the OS, which does
# not map *.localhost everywhere. On a CI runner, add it to the hosts file.
if [ -n "${GITHUB_ACTIONS:-}" ] && ! grep -q "[[:space:]]$SERVED_HOST\$" /etc/hosts; then
  echo "127.0.0.1 $SERVED_HOST" | sudo tee -a /etc/hosts > /dev/null
fi

rc=0
echo "::group::prod smoke against the local Worker"
SMOKE_BASE_URL="$BASE_URL" npm run test:smoke || rc=1
echo "::endgroup::"
if [ -s "$specs" ]; then
  echo "::group::this PR's served specs against the local Worker"
  # shellcheck disable=SC2046 # one spec path per line, no spaces
  AFTERSIGN_BASE_URL="$BASE_URL/aftersign/" npx playwright test $(tr '\n' ' ' < "$specs") --config aftersign/playwright.config.ts || rc=1
  echo "::endgroup::"
fi
if [ "$rc" != 0 ]; then
  echo "::error::served-worker: failed against the real Worker. Reproduce: bash scripts/ci/served-worker.sh --all <spec paths>"
fi
exit "$rc"
