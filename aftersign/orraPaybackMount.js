// AFTERSIGN M3-E1 (#2260) — Saint Orra's red-tag payback: served mount.
//
// This module is loaded as a sibling <script type="module"> next to
// main.js in aftersign/index.html. It owns the DOM contract the
// played e2e `orra-payback.playtest.spec.ts` pins:
//
//   1. At the `io-return-recognition` beat that FOLLOWS a red-tag
//      return, a `<button data-orra-payback-action="…">` is mounted
//      into the offered-jobs tray with the action resolved from the
//      durable red-tag delivery outcome.
//   2. On tap, `#line` is restamped with the matching
//      `data-beat-id="ending-bell-archive"` or
//      `data-beat-id="ending-orra-keeps-name"`.
//   3. The ending stamp is persisted keyed by the URL `slot` so
//      a reload re-stamps the same ending.
//
// Why a sibling module instead of a main.js hunk: main.js owns the
// render loop and is >200KB; isolating the payback render here keeps
// the surface small, idempotent, and independently testable. The
// bridge is a MutationObserver on `#line`'s `data-beat-id` attribute
// — the SAME attribute stampAftersignBeat (main.js's render loop)
// already writes on every beat transition, so we react to the beat
// the player actually sees without reaching into the render loop.
//
// Red-tag outcome source: `window.__game.state.delivery` carries
// `{ id, outcome }` once the second packet has resolved. The pure
// resolver `orraPaybackActionForDelivery` picks the action; we only
// mount when the resolver reports a payback is due AND the current
// beat is `io-return-recognition`. First-return (pre-red-tag) does
// NOT mount — that beat is Io's return-tone fork, not Orra's payback.
//
// Reload authority: `localStorage[`aftersign:orra-payback:ending:${slot}`]`
// stores the chosen ending-beat id. On DOMContentLoaded, if the key
// is set we immediately stamp the ending onto `#line` so the reload
// path lands on `data-beat-id="ending-*"` without re-walking the
// story graph.

import {
  orraPaybackActionForDelivery,
  orraPaybackLabel,
  orraPaybackEndingBeat,
  ORRA_PAYBACK_ACTION,
} from "./src/orraPayback.js";

const RECOGNITION_BEAT_ID = "io-return-recognition";
const PAYBACK_BUTTON_SELECTOR = "[data-orra-payback-action]";
const PAYBACK_TRAY_ID = "orraPaybackTray";
const LINE_SELECTOR = "#line";
const BEAT_ATTR = "data-beat-id";
const CHOICE_ATTR = "data-choice-id";
const STORAGE_PREFIX = "aftersign:orra-payback:ending:";

/** Read the URL `slot` param so each spec variant has its own save. */
function readSlot() {
  try {
    return new URL(window.location.href).searchParams.get("slot") ?? "default";
  } catch {
    return "default";
  }
}

function storageKey() {
  return `${STORAGE_PREFIX}${readSlot()}`;
}

function readPersistedEnding() {
  try {
    return window.localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

function persistEnding(endingBeatId) {
  try {
    window.localStorage.setItem(storageKey(), endingBeatId);
  } catch {
    // non-fatal: reload won't resume but the live tap still works.
  }
}

/** The red tag has returned and the player is at Orra's payback beat. */
function paybackIsDue() {
  const state = window.__game?.state;
  const delivery = state?.delivery;
  if (!delivery || delivery.id !== "red-tag") return false;
  if (delivery.outcome !== "sealed" && delivery.outcome !== "opened") {
    return false;
  }
  return true;
}

/** Find the tray node, creating it once if needed. Mounted next to
 *  `#line` so the choice reads as part of the same beat column. */
function ensureTray() {
  const existing = document.getElementById(PAYBACK_TRAY_ID);
  if (existing) return existing;
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode || !lineNode.parentNode) return null;
  const tray = document.createElement("div");
  tray.id = PAYBACK_TRAY_ID;
  tray.setAttribute("role", "group");
  tray.setAttribute("aria-label", "Saint Orra's payback");
  lineNode.parentNode.insertBefore(tray, lineNode.nextSibling);
  return tray;
}

function stampEnding(endingBeatId) {
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode) return;
  lineNode.setAttribute(BEAT_ATTR, endingBeatId);
  lineNode.removeAttribute(CHOICE_ATTR);
  const tray = document.getElementById(PAYBACK_TRAY_ID);
  if (tray) tray.replaceChildren();
}

function mountPaybackButton() {
  if (!paybackIsDue()) return;
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode) return;
  if (lineNode.getAttribute(BEAT_ATTR) !== RECOGNITION_BEAT_ID) return;

  const delivery = window.__game.state.delivery;
  const action = orraPaybackActionForDelivery(delivery);
  const endingBeatId = orraPaybackEndingBeat(action);
  const label = orraPaybackLabel(action);

  const tray = ensureTray();
  if (!tray) return;

  const existing = tray.querySelector(PAYBACK_BUTTON_SELECTOR);
  if (existing && existing.getAttribute("data-orra-payback-action") === action) {
    return; // idempotent: same action already mounted
  }
  tray.replaceChildren();

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("data-orra-payback-action", action);
  button.setAttribute("data-choice-id", action);
  button.disabled = false;
  button.addEventListener(
    "click",
    () => {
      persistEnding(endingBeatId);
      stampEnding(endingBeatId);
    },
    { once: true },
  );
  tray.appendChild(button);
}

function teardownTrayIfBeatMoved() {
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode) return;
  const beat = lineNode.getAttribute(BEAT_ATTR);
  if (beat === RECOGNITION_BEAT_ID) return;
  if (beat === "ending-bell-archive" || beat === "ending-orra-keeps-name") {
    return;
  }
  const tray = document.getElementById(PAYBACK_TRAY_ID);
  if (tray) tray.replaceChildren();
}

function resumePersistedEnding() {
  const endingBeatId = readPersistedEnding();
  if (!endingBeatId) return false;
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode) return false;
  // Only resume once the DOM contract (#line) is in place. Stamp
  // the ending beat so a reload lands on `[data-beat-id="ending-*"]`
  // without walking the story graph. Validity-check the token so a
  // corrupted localStorage write can't poison the beat axis.
  if (
    endingBeatId !== "ending-bell-archive" &&
    endingBeatId !== "ending-orra-keeps-name"
  ) {
    return false;
  }
  lineNode.setAttribute(BEAT_ATTR, endingBeatId);
  return true;
}

function boot() {
  const lineNode = document.querySelector(LINE_SELECTOR);
  if (!lineNode) {
    // #line hasn't been parsed yet; retry on DOMContentLoaded.
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    return;
  }

  if (resumePersistedEnding()) {
    return;
  }

  const observer = new MutationObserver(() => {
    mountPaybackButton();
    teardownTrayIfBeatMoved();
  });
  observer.observe(lineNode, {
    attributes: true,
    attributeFilter: [BEAT_ATTR],
  });

  // Initial pass in case the beat is already set when we attach.
  mountPaybackButton();
  teardownTrayIfBeatMoved();
}

boot();

// Named export used only by the vitest harness alongside the pure
// resolver — keeps the module import-safe under jsdom.
export const __test__ = {
  mountPaybackButton,
  stampEnding,
  resumePersistedEnding,
  paybackIsDue,
  RECOGNITION_BEAT_ID,
  ORRA_PAYBACK_ACTION,
};
