# AFTERSIGN e2e input-boundary audit

The flagship brief defines `window.__game` as an assertion surface rather than an input surface for milestone acceptance. The current e2e suite still contains specs that invoke `window.__game.input.*`; these must be explicitly classified as harness-only or replaced with rendered-control interactions before they can serve as played acceptance evidence.

This note records the audit finding so the tracking issue can keep the implementation scope player-facing.
