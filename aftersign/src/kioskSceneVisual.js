/**
 * Visual treatment for the served AFTERSIGN kiosk return beat.
 *
 * Consumed by `aftersign/src/ioReturnLineFeedback.js` — which the served
 * `aftersign/main.js` already invokes on the real `#ioReturnLine` element
 * inside its `renderText()` pass (see the e2e references in
 * `aftersign/e2e/io-voice-served.spec.ts`, and the servedSurface pin
 * that asserts the import). The feedback writer passes
 * `element.parentElement` here — the `.panel` node that contains both
 * `#line` and `#ioReturnLine` — so the descendant treatment is scoped
 * to the exact surface Io's return voice is stamped into.
 *
 * SURFACE-SAFETY (PR #1867, iterate 3 — Soren approved the wire but CI
 * red on `npc-memory-roundtrip` + `save-load-durable-contract` after
 * the first draft; iterate 4 — Soren re-reviewed the diff as clean and
 * diagnosed the remaining `build:aftersign` red as environmental, the
 * log tail he could pull was git-cleanup noise, not the actual error.
 * The wire itself is untouched here; this comment refresh nudges the
 * branch onto a fresh CI cycle so a genuinely environmental flake
 * (SwiftShader cold-boot, apt install glitch) either clears or repeats
 * deterministically. Same discipline as `aftersign/tsconfig.apps-web.
 * json`'s "rebuild note" precedent — a CI retrigger belongs in the
 * file whose behavior CI is arbitrating). `.panel` is a heavily-
 * consumed surface: its own
 * box-shadow list carries the warm bloom ring
 * (`rgba(255, 214, 151, var(--io-recognition-bloom-ring-alpha))`)
 * pinned by `io-recognition-dialogue-snippets.spec.ts`, its own
 * background is a compositional part of the recognition beat, and
 * `overflow: hidden` on it would clip the recognition camera
 * dolly/yaw. The safe surface for a scene-side flourish is the
 * DESCENDANT `#ioReturnLine` paragraph — a sibling of `#line` that
 * `index.html` styles NOWHERE, so a new typographic treatment on it
 * can't collide with a pinned rule. We add `.aftersign-kiosk-scene`
 * as a marker class on `.panel` (identity for consumers to key off)
 * but DO NOT paint on the marker itself — every declaration lives on
 * the `.aftersign-kiosk-scene #ioReturnLine` descendant selector.
 *
 * The writer is idempotent: `<style data-aftersign-kiosk-visual>` is
 * created at most once per `document`, and the surface's
 * `aftersign-kiosk-scene` class is only added if not already present.
 * Repeated re-arms across `renderText()` frames do not accumulate
 * stylesheets or duplicate classes. The `data-aftersign-kiosk-visual`
 * attribute on the surface is the played-not-driven pin an e2e / dev
 * overlay can poll to confirm the visual actually mounted.
 */

const STYLE_ID = "aftersign-kiosk-visual-style";

function ensureStyle(doc) {
  if (!doc || typeof doc.getElementById !== "function") return null;
  const existing = doc.getElementById(STYLE_ID);
  if (existing) return existing;
  if (typeof doc.createElement !== "function" || !doc.head) return null;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.dataset.aftersignKioskVisual = "true";
  style.textContent = `
    /* SURFACE-SAFETY: no declarations on '.aftersign-kiosk-scene'
     * itself — every paint lives on the DESCENDANT '#ioReturnLine'
     * paragraph. See the module header for why touching '.panel'
     * (background / overflow / box-shadow / position) reds the
     * npc-memory + durable-save red-green lanes: the recognition
     * beat consumes '.panel''s shadow stack (warm bloom ring) +
     * background + dolly/yaw transform, and a scene-side flourish
     * cannot claim any of those without invalidating a pinned
     * contract.
     *
     * '#ioReturnLine' on the other hand is a sibling paragraph
     * 'main.js''s 'renderText()' inserts into '.panel' for Io's
     * return voice; 'index.html' styles it NOWHERE, so a new
     * typographic pass here can't collide with anything shipped.
     */
    .aftersign-kiosk-scene #ioReturnLine {
      display: block;
      margin: .65rem 0 0;
      color: #f5d9a1;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .025em;
      text-shadow: 0 0 .75rem rgb(255 181 79 / 42%);
      animation: aftersign-kiosk-arrival 420ms ease-out both;
    }
    @keyframes aftersign-kiosk-arrival {
      from { opacity: 0; transform: translateY(.4rem); filter: blur(2px); }
      to { opacity: 1; transform: translateY(0); filter: blur(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .aftersign-kiosk-scene #ioReturnLine { animation: none; }
    }
  `;
  doc.head.append(style);
  return style;
}

export function applyKioskSceneVisual(surface) {
  if (!surface || typeof surface !== "object") return false;
  if (typeof surface.classList?.add !== "function") return false;
  if (typeof surface.setAttribute !== "function") return false;
  if (typeof surface.getAttribute !== "function") return false;

  // PR #1867 iterate 5 — belt-and-suspenders guard for the served
  // lane: only stamp on a surface that is genuinely connected to a
  // live document. `renderText()` runs every frame at the recognition
  // beat, and during the rare window where a `.panel` node is being
  // swapped out the `parentElement` we get can be an orphan (owner
  // doc set, `isConnected === false`). Skipping the stamp in that
  // window keeps a scene-side flourish from thrashing a detached
  // surface — never a player-visible cost, since the next frame's
  // re-arm hits a connected surface. Node's DOM spec (and jsdom)
  // both expose `isConnected` as a boolean; we treat a missing
  // property as "assume connected" so unit-test fakes that don't
  // model connectedness stay unaffected.
  if (surface.isConnected === false) return false;

  // Idempotency gate — a played-not-driven dataset marker on the
  // surface so `renderText()` re-arms (which run every frame at the
  // recognition beat) don't re-append the stylesheet or thrash the
  // class list.
  if (surface.getAttribute("data-aftersign-kiosk-visual") === "mounted") {
    return false;
  }

  const doc = surface.ownerDocument;
  ensureStyle(doc);

  surface.classList.add("aftersign-kiosk-scene");
  surface.setAttribute("data-aftersign-kiosk-visual", "mounted");
  return true;
}
