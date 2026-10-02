# Production durable-save verification

**Issue:** #2064  
**Owner:** operator-coordinated  
**Status:** blocked pending a deployed production bundle and an authorized production test identity

## Purpose

Verify the deployed AFTERSIGN Worker, rather than a local preview, preserves a played delivery outcome and character memory across a fresh browser session. This is deployment evidence, not a substitute for the local harness.

## Required record

Before running, record:

- Deployment SHA:
- Deployment timestamp:
- Production URL:
- Test player identity / isolated test account:
- Browser and phone viewport:

## Played route

1. Open the production AFTERSIGN page in a phone-shaped browser viewport.
2. Complete the rendered route by tapping visible controls: accept the safe offer, receive the packet, acknowledge it, deliver it, return to Io, and request the next job.
3. Record the visible final beat, selected outcome, and displayed revision or equivalent save marker.
4. Inspect every save request made during the route. PUT, GET, and DELETE responses must be 2xx; record any non-2xx response with URL and status.
5. Close the browser context. Do not reuse storage, session state, or a harness input hook.
6. Create a fresh browser context for the same durable player identity and reopen the production URL.
7. Verify the restored beat, recorded outcome, character-memory recognition, and revision remain present rather than returning to `packet-offered`.
8. Tap the rendered continuation into round two and record the returning offer shown by the page.

## Pass criteria

- The deployed bundle contains the fixes intended for the save path.
- The played tap route reaches `io-next-job`.
- A fresh session restores the final beat, outcome, memory, and revision server-authoritatively.
- Save PUT, GET, and DELETE requests are all 2xx.
- A returning offer can be entered by a rendered control in round two.

## Result

- Deployment SHA:
- Route result:
- Reload result:
- Memory result:
- Revision result:
- Save request status summary:
- Round-two result:
- Evidence links / screenshots:
- Operator:
- Date:
