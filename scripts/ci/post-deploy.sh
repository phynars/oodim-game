#!/usr/bin/env bash
# Post-deploy checks (were inline in deploy.yml; moved 11-09 when the deploys
# became rendered from the oodim repo profile). They run only after a
# successful wrangler deploy, against BASE_URL (production or staging).
#
#   post-deploy.sh smoke          the games are actually playable (blocking;
#                                 on staging the games-load specs only)
#   post-deploy.sh m-loop         production only: M-LOOP gate, served
#                                 two-round phone divergence (blocking;
#                                 evidence is uploaded with the deploy's artifacts)
#   post-deploy.sh served-replay  production pushes only: replay this deploy's
#                                 served specs against the live site and post
#                                 the `served-replay` check run the engine's
#                                 live-verify reads (report only, never fails)
#
# Env from the workflow: DEPLOY_ENV, BASE_URL, EVENT_NAME, PUSH_BEFORE,
# RUN_URL, GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA.
set -euo pipefail

browser() { npx playwright install --with-deps chromium; }

case "${1:-}" in
  smoke)
    sleep 30 # let the new version reach the edge
    browser
    if [ "$DEPLOY_ENV" = production ]; then
      SMOKE_BASE_URL="$BASE_URL" npm run test:smoke
    else
      # Staging has no save backend (wrangler.staging.jsonc binds no Durable
      # Object), so only the games-load half of the smoke applies there.
      SMOKE_BASE_URL="$BASE_URL" npm run test:smoke -- games-playable.spec.ts
    fi
    ;;
  m-loop)
    if [ "$DEPLOY_ENV" != production ]; then
      echo "M-LOOP gate: production only (it saves across rounds; staging has no save backend); skipped"
      exit 0
    fi
    browser
    AFTERSIGN_BASE_URL="$BASE_URL/aftersign/" npx playwright test m-loop-two-round-divergence.playtest.spec.ts --config aftersign/playwright.config.ts
    ;;
  served-replay)
    if [ "$DEPLOY_ENV" != production ] || [ "$EVENT_NAME" != push ]; then
      echo "served replay: production pushes only ($DEPLOY_ENV/$EVENT_NAME); skipped"
      exit 0
    fi
    set +e
    (
      set -uo pipefail
      repo="$GITHUB_REPOSITORY"
      export AFTERSIGN_BASE_URL="$BASE_URL/aftersign/"
      # The base is the last successful deploy of main (else the push's before).
      base="$(gh run list -R "$repo" --workflow deploy.yml --branch main --status success --limit 1 --json headSha --jq '.[0].headSha // empty' || true)"
      if [ -z "$base" ] || [ "$base" = "$GITHUB_SHA" ]; then base="$PUSH_BEFORE"; fi
      : > /tmp/replay-files.txt
      gh api "repos/$repo/compare/${base}...${GITHUB_SHA}" --jq '.files[] | select(.status != "removed") | .filename' > /tmp/replay-files.txt \
        || echo "::warning::served replay: compare ${base}...${GITHUB_SHA} unreadable; replaying nothing"
      node scripts/served-replay.mjs plan /tmp/replay-files.txt > /tmp/replay-specs.txt
      echo "base ${base}; specs to replay:"
      cat /tmp/replay-specs.txt
      rm -f aftersign/playwright-report/results.json
      if [ -s /tmp/replay-specs.txt ]; then
        # shellcheck disable=SC2046 # one spec path per line, no spaces
        timeout 25m npx playwright test $(tr '\n' ' ' < /tmp/replay-specs.txt) --config aftersign/playwright.config.ts \
          || echo "::warning::served replay: at least one spec failed on the live site"
      fi
      node scripts/served-replay.mjs report --base "$base" --sha "$GITHUB_SHA" --specs /tmp/replay-specs.txt --results aftersign/playwright-report/results.json > /tmp/replay-check.json
      gh api -X POST "repos/$repo/check-runs" --input /tmp/replay-check.json --jq '"served-replay check: \(.conclusion) \(.html_url)"'
    )
    status=$?
    [ "$status" -eq 0 ] || echo "::warning::served replay did not complete (exit $status); report only"
    exit 0
    ;;
  *)
    echo "usage: $0 smoke|m-loop|served-replay" >&2
    exit 2
    ;;
esac
