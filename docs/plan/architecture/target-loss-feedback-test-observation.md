# Target-loss feedback test observation

The target-loss acceptance test installs sampler callbacks on `window` to observe an animation envelope in the served game. Those callbacks are test-local instrumentation and should be removed before the test completes, so a future multi-scenario spec cannot accidentally observe stale state from an earlier scenario.

This is an exploration note, not a product requirement.
