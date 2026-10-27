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
//
// Harness input (game #2529, 2026-10-27): a line counts only if the spec
// reached it through real input (click, key, tap, page reload). #2520's
// Orra greeting passed this rule, but its spec reached it through
// `window.__game.input.choose("return-to-orra")`, an id no served button
// sends, so no player could see it. So `window.__game` is wrapped here:
// the first call to a harness method that can move the story (choose,
// advance, packet*, render*, forceReload, ...) taints the page. Lines first
// seen after that are posted as `{ t, via }` and the rule does not count
// them. The taint survives a reload in the same tab (sessionStorage), so
// "advance by harness, forceSave, reload" is still harness. `reset` /
// `resetSliceSave` start a fresh player and clear it. Read-only methods
// (get*, assert*, waitFor*, ...) and feel/style probes never taint.
(() => {
  const ENDPOINT = `${location.origin}/aftersign/__rendered`;
  const ATTRS = ["aria-label", "title", "placeholder", "alt"];
  const TAINT_KEY = "aftersign:rendered-harness";
  // Harness methods that cannot change which text is on screen.
  const READ_ONLY = /^(get|assert|waitFor|measure|is|has)[A-Z]|^(enableAudio|forceSave|stepCameraRig|setConfirmCameraKick|setRecognitionCameraEnvelope|resetPointerToRenderLatency|markPointerIntent|markPointerRendered|apply[A-Za-z]*Feel)$/;
  const FRESH = /^(reset|resetSliceSave)$/;
  const seen = new Set();
  let pending = [];
  let timer = 0;
  let via = null;
  try { via = sessionStorage.getItem(TAINT_KEY); } catch {}

  const norm = (s) => s.replace(/\s+/g, " ").trim();
  // Opacity is ignored on purpose: lines fade in by CSS transition, which
  // fires no mutation, so an opacity check would miss them for good.
  const visible = (el) =>
    typeof el.checkVisibility === "function" ? el.checkVisibility({ visibilityProperty: true }) : true;

  // Text first shown after harness input never counts as real input on this
  // page, even after a reset: it can still be on screen until the next render.
  const harnessText = new Set();

  const add = (s) => {
    const t = norm(s);
    const key = (via ? "h\0" : "u\0") + t;
    if (t.length < 4 || seen.has(key) || (!via && harnessText.has(t))) return;
    seen.add(key);
    if (via) harnessText.add(t);
    pending.push(via ? { t, via } : t);
  };

  const harnessCall = (name) => {
    if (READ_ONLY.test(name.split(".").pop())) return;
    if (FRESH.test(name)) {
      if (via) collect();
      via = null;
      try { sessionStorage.removeItem(TAINT_KEY); } catch {}
      return;
    }
    if (via) return;
    // Lines already on screen were reached by real input: record them first.
    collect();
    via = name;
    try { sessionStorage.setItem(TAINT_KEY, name); } catch {}
  };

  const wrap = (obj, prefix) =>
    new Proxy(obj, {
      get(target, key, receiver) {
        const v = Reflect.get(target, key, receiver);
        if (typeof key !== "string") return v;
        if (typeof v === "function") {
          return function (...a) { harnessCall(prefix + key); return v.apply(this === receiver ? target : this, a); };
        }
        if (key === "input" && v && typeof v === "object") return wrap(v, "input.");
        return v;
      },
    });

  // main.js assigns `window.__game = {...}` on every publish; wrap each one.
  let game;
  Object.defineProperty(window, "__game", {
    configurable: true,
    get: () => game,
    set: (v) => { game = v && typeof v === "object" ? wrap(v, "") : v; },
  });

  const collectFrom = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.currentNode; el; el = walker.nextNode()) {
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || !visible(el)) continue;
      let own = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { own = true; break; }
      if (own) add(el.textContent ?? "");
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v) add(v); }
    }
  };

  const collect = () => {
    timer = 0;
    if (!document.body) return;
    collectFrom(document.body);
    flush();
  };

  // Text changes are recorded at once, from the changed elements only (game
  // #2532 follow-up, 10-27): a spec that ends on `expect(#line).toContainText`
  // closes the page before the timed scan runs, so the last line it asserted
  // was never recorded. #2530's Orra greeting was lost this way. A mutation
  // callback runs before Playwright's next poll can see the text, so the POST
  // is already sent when the assertion passes. The timed full scan stays the
  // backstop for visibility-only changes (class, style, hidden).
  const onMutations = (mutations) => {
    const roots = new Set();
    for (const m of mutations) {
      if (m.type === "characterData") { if (m.target.parentElement) roots.add(m.target.parentElement); }
      else if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) roots.add(n);
          else if (n.nodeType === 3 && n.parentElement) roots.add(n.parentElement);
        }
      }
    }
    for (const r of roots) if (r.isConnected) collectFrom(r);
    flush();
    schedule();
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
    new MutationObserver(onMutations).observe(document.body, {
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
