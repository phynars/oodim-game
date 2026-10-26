// Rendered-text recorder (served-reach `rendered` rule, oodim engine review
// 2026-10-26, game #2511).
//
// Why: served-reach's `text` rule checks that a PR's new strings are in the
// built bundle. A string can be bundled and still never shown: #2499's copy
// shipped because aftersign/main.js imported its whole dialogue table for a
// `.length` guard while the line's selector was never called. Only a served
// playtest can show that a player sees a line.
//
// This script is NOT part of the game. aftersign/vite.config.ts inlines it
// into index.html only when AFTERSIGN_RENDERED_OUT is set (the CI e2e step),
// and the preview server appends what it posts to that file. It records the
// text of every element a player could see, plus the aria-label / title /
// placeholder / alt values, as each Playwright spec plays.
(() => {
  const ENDPOINT = `${location.origin}/aftersign/__rendered`;
  const ATTRS = ["aria-label", "title", "placeholder", "alt"];
  const seen = new Set();
  let pending = [];
  let timer = 0;

  const norm = (s) => s.replace(/\s+/g, " ").trim();
  // Opacity is ignored on purpose: lines fade in by CSS transition, which
  // fires no mutation, so an opacity check would miss them for good.
  const visible = (el) =>
    typeof el.checkVisibility === "function" ? el.checkVisibility({ visibilityProperty: true }) : true;

  const add = (s) => {
    const t = norm(s);
    if (t.length < 4 || seen.has(t)) return;
    seen.add(t);
    pending.push(t);
  };

  const collect = () => {
    timer = 0;
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.currentNode; el; el = walker.nextNode()) {
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || !visible(el)) continue;
      let own = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { own = true; break; }
      if (own) add(el.textContent ?? "");
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v) add(v); }
    }
    flush();
  };

  const flush = () => {
    if (pending.length === 0) return;
    const body = JSON.stringify(pending);
    pending = [];
    fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  };

  // Collect when the page is idle so the recorder never competes with a
  // spec's own timing marks (frame, audio, settle budgets).
  const idle = (fn) =>
    typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 0);
  // Short on purpose: a spec can end (page closed) right after a line shows,
  // and a 300 ms debounce lost 7 of 41 lines in the skipped-route playtest.
  const schedule = () => { if (!timer) timer = setTimeout(() => idle(collect), 120); };

  const start = () => {
    new MutationObserver(schedule).observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["class", "style", "hidden", "open", "aria-hidden", ...ATTRS],
    });
    // Backstop for changes no mutation reports (a parent's visibility via a
    // stylesheet swap, media queries).
    setInterval(schedule, 1000);
    addEventListener("pagehide", collect);
    collect();
  };

  if (document.body) start();
  else addEventListener("DOMContentLoaded", start, { once: true });
})();
