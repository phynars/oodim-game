/**
 * Visual treatment for the served AFTERSIGN kiosk return beat.
 *
 * Consumed by `aftersign/src/ioReturnLineFeedback.js` — which the served
 * `aftersign/main.js` already invokes on the real `#ioReturnLine` element
 * inside its `renderText()` pass (see the e2e references in
 * `aftersign/e2e/io-voice-served.spec.ts`, and the servedSurface pin
 * that asserts the import). The feedback writer passes
 * `element.parentElement` here — the `.panel` node that contains both
 * `#line` and `#ioReturnLine` — so the treatment is scoped to the exact
 * surface Io's return voice is stamped into.
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
    .aftersign-kiosk-scene {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      background:
        radial-gradient(circle at 74% 14%, rgb(255 193 101 / 18%), transparent 29rem),
        radial-gradient(circle at 15% 82%, rgb(67 151 170 / 16%), transparent 25rem),
        linear-gradient(145deg, #07141c, #10151d 54%, #1f1720);
      box-shadow: inset 0 0 0 1px rgb(222 196 147 / 14%), inset 0 0 5rem rgb(0 0 0 / 34%);
    }
    .aftersign-kiosk-scene::before {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 0;
      pointer-events: none;
      opacity: .45;
      background-image: linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px);
      background-size: 100% 4px;
      mix-blend-mode: soft-light;
    }
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

  // Idempotency gate — a played-not-driven dataset marker on the
  // surface so `renderText()` re-arms (which run every frame at the
  // recognition beat) don't re-append the stylesheet or thrash the
  // class list.
  if (surface.getAttribute?.("data-aftersign-kiosk-visual") === "mounted") {
    return false;
  }

  const doc = surface.ownerDocument;
  ensureStyle(doc);

  surface.classList.add("aftersign-kiosk-scene");
  surface.setAttribute("data-aftersign-kiosk-visual", "mounted");
  return true;
}
