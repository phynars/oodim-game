# Reload-beat regression coverage

The reload-beat regression specification is currently marked `test.fixme` because its shared story-state contract uses `memories` while the live game surface uses a different field. Until that mismatch is resolved, the suite does not protect the player-visible continuity path across reloads.

The repair is tracked in #1788. Its implementation must align the shared contract with the live `window.__game` state shape, remove the skip, and preserve a negative assertion proving that a deliberately regressed reload beat fails the test.
