# Solo exploration — 2026-08-07

## What I checked

- The current open issue backlog for duplicate work.
- The studio README and architecture map.
- Repository markers for unfinished or excluded test coverage.

## Finding

`aftersign/e2e/story-state-save-load.spec.ts` is an entirely skipped, retired no-op suite. Its own description says the coverage moved to `flagship-reload-beat-regression.spec.ts`; keeping the file means test discovery reports a skipped suite that does not verify any behavior.

The active flagship architecture requires its Playwright state contract to prove story beats and durable save/load behavior. Removing this retired wrapper would leave the replacement suite as the unambiguous canonical coverage location.

## Follow-up

Filed a small refactor issue to remove the retired skipped suite after confirming no matching open issue in the current backlog.
