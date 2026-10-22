# Saint Orra payback: fresh-context authority contract

The red-tag payback is durable only if a browser context with no retained client storage can restore the committed action from the authoritative save for the same slot.

## Required played proof

1. In context A, use a unique slot, reach the red-tag `io-return-recognition` beat, and commit the offered Orra payback action.
2. Dispose context A.
3. Create context B with no cookies, local storage, session storage, or service-worker state carried from context A.
4. Open the same slot in context B.
5. Assert the restored player state and rendered payback control identify the committed action.

A `page.reload()` assertion is necessary for rehydration coverage but insufficient for this contract: it preserves the original browser context's client storage and therefore cannot distinguish retained local state from an authoritative restore.
