// Bell Archive scene checks (#2691), run by aftersign/pure-runner.ts.
// Export-only: no top-level call. The only relative import is the
// extensioned `./bellArchiveScene.ts`, and that file has no relative
// imports, so this runs under `node --experimental-strip-types`.
// No jsdom in this lane, so a small element stub stands in for Document.

import {
  BELL_ARCHIVE_OUTCOME_ATTRIBUTE,
  bellArchiveChoices,
  renderBellArchiveScene,
  resolveBellArchiveOutcome,
} from "./bellArchiveScene.ts";

type Listener = () => unknown;

class StubElement {
  tagName: string;
  attrs = new Map<string, string>();
  children: StubElement[] = [];
  listeners: Listener[] = [];
  style: Record<string, string> = {};
  className = "";
  textContent = "";
  type = "";
  disabled = false;
  classList = {
    add: (...names: string[]) => {
      this.className = [this.className, ...names].filter(Boolean).join(" ");
    },
  };
  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, String(value));
  }
  getAttribute(name: string) {
    return this.attrs.has(name) ? this.attrs.get(name)! : null;
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  appendChild(child: StubElement) {
    this.children.push(child);
    return child;
  }
  append(...nodes: StubElement[]) {
    this.children.push(...nodes);
  }
  addEventListener(_type: string, fn: Listener) {
    this.listeners.push(fn);
  }
  descendants(): StubElement[] {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  querySelectorAll(selector: string) {
    return this.descendants().filter((el) => el.tagName === selector.toUpperCase());
  }
  click() {
    for (const fn of this.listeners) void fn();
  }
  allText(): string {
    return this.textContent + this.children.map((c) => c.allText()).join("");
  }
}

const stubDocument = () =>
  ({ createElement: (tag: string) => new StubElement(tag) }) as unknown as Document;

const assert = (cond: unknown, message: string) => {
  if (!cond) throw new Error(`bellArchiveScene: ${message}`);
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const choiceButton = (scene: HTMLElement, id: string) =>
  (scene as unknown as StubElement)
    .descendants()
    .find((el) => el.getAttribute("data-maud-name-choice") === id);

export async function runBellArchiveSceneChecks(): Promise<void> {
  assert(resolveBellArchiveOutcome("Ada", { name: "Ada" }).outcome === "matched", "sealed name matches");
  assert(
    resolveBellArchiveOutcome("Mara Vell", { name: "Ada" }).outcome === "unmatched",
    "decoy is unmatched",
  );
  assert(
    bellArchiveChoices("Ada").map((c) => c.name).join("|") === "Ada|Mara Vell|Orra Bell",
    "choice set is sealed name plus two decoys",
  );

  // Maud's scene renders with three visible name choices.
  const plain = renderBellArchiveScene(stubDocument(), {
    sealedName: "Ada",
    persistOutcome: () => undefined,
    showEndingCard: () => undefined,
  });
  assert(plain.getAttribute("data-beat") === "maud-bell-archive", "scene carries the Maud beat id");
  assert((plain as unknown as StubElement).allText().includes("Maud Underbell"), "Maud is named");
  assert(plain.querySelectorAll("button").length === 3, "three name buttons");

  // The ending card waits for persistence.
  let release: () => void = () => undefined;
  const persisted = new Promise<void>((resolve) => {
    release = resolve;
  });
  let persistCalls = 0;
  const cards: string[] = [];
  const gated = renderBellArchiveScene(stubDocument(), {
    sealedName: "Ada",
    persistOutcome: () => {
      persistCalls += 1;
      return persisted;
    },
    showEndingCard: (_slot, resolved) => cards.push(resolved.outcome),
  });
  choiceButton(gated, "archive-decoy")!.click();
  await flush();
  assert(persistCalls === 1, "persist runs once on tap");
  assert(gated.getAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE) === "unmatched", "outcome stamped on tap");
  assert(cards.length === 0, "card does not render before persistence settles");
  choiceButton(gated, "remembered-name")!.click();
  await flush();
  assert(persistCalls === 1, "second tap is ignored once locked");
  release();
  await flush();
  assert(cards.length === 1 && cards[0] === "unmatched", "card renders after persistence settles");

  // A failed persist still shows the card.
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const failCards: string[] = [];
    const failing = renderBellArchiveScene(stubDocument(), {
      sealedName: "Ada",
      persistOutcome: () => Promise.reject(new Error("offline")),
      showEndingCard: (_slot, resolved) => failCards.push(resolved.outcome),
    });
    choiceButton(failing, "remembered-name")!.click();
    await flush();
    assert(failCards.length === 1 && failCards[0] === "matched", "card still renders when persist rejects");
    assert(failing.getAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE) === "matched", "matched stamped");
  } finally {
    console.warn = originalWarn;
  }
}
