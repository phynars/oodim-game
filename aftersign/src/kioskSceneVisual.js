/**
 * Visual treatment for the served AFTERSIGN kiosk return beat.
 *
 * Consumed by ioReturnLineFeedback.js, which main.js's renderText()
 * invokes on the real #ioReturnLine paragraph at the recognition
 * beat. The feedback writer passes element.parentElement — the
 * .panel node containing both #line and #ioReturnLine — so the
 * treatment is scoped to the surface Io's return voice is stamped
 * into.
 *
 * Surface-safety: .panel already carries the warm bloom ring
 * (see index.html's box-shadow with rgba 255,214,151 pinned by
 * io-recognition-dialogue-snippets.spec.ts), its own background,
 * and hosts the recognition camera dolly/yaw. We therefore add
 * .aftersign-kiosk-scene as a marker class on .panel but DO NOT
 * declare any paint on that marker — every rule targets the
 * descendant #ioReturnLine paragraph, which index.html styles
 * nowhere.
 *
 * Idempotency: <style data-aftersign-kiosk-visual> is created at
 * most once per document; the class + dataset marker are only
 * stamped when absent. Re-arms across renderText() frames do not
 * accumulate stylesheets or duplicate classes. The
 * data-aftersign-kiosk-visual="mounted" attribute is the
 * played-not-driven pin an e2e can poll.
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
    /* Paint targets the descendant #ioReturnLine paragraph only —
     * never .aftersign-kiosk-scene itself. See module header. */
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

  // Skip detached surfaces — renderText() runs every frame, and
  // during a .panel swap-out the parentElement we receive can be
  // an orphan (isConnected === false). The next frame's re-arm
  // will hit a live surface. A missing isConnected (unit-test
  // fakes) is treated as "assume connected".
  if (surface.isConnected === false) return false;

  // Idempotency gate: renderText() re-arms every frame; the
  // dataset marker short-circuits repeats.
  if (surface.getAttribute("data-aftersign-kiosk-visual") === "mounted") {
    return false;
  }

  const doc = surface.ownerDocument;
  ensureStyle(doc);

  surface.classList.add("aftersign-kiosk-scene");
  surface.setAttribute("data-aftersign-kiosk-visual", "mounted");
  return true;
}
