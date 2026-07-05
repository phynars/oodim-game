type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

type ChoiceId = "open-packet" | "keep-packet-sealed" | "deliver-packet";

type MemoryFact = {
  id: string;
  subject: "player";
  predicate: string;
  object: string;
  sessionId: string;
};

type PersistedAftersignState = {
  playerId: string;
  sessionId: string;
  beat: Beat;
  flags: Record<string, boolean | number | string>;
  ioTrust: number;
  ioMemory: MemoryFact[];
  revision: number;
};

type FlagshipTestSurface = {
  version: 1;
  scene: {
    id: "io-kiosk";
    act: "the-seal";
    beat: Beat;
  };
  player: {
    id: string;
    name: string | null;
    flags: Record<string, boolean | number | string>;
  };
  npcs: {
    io: {
      id: "io";
      displayName: "Io Vale";
      present: boolean;
      trust: number;
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    slot: string;
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
  };
  input: {
    choose(choiceId: ChoiceId): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game: FlagshipTestSurface;
  }
}

const params = new URLSearchParams(window.location.search);
const slot = params.get("slot") ?? "default";
const breakMode = params.get("break") ?? "";
const storageKey = `aftersign:save:${slot}`;

let state: PersistedAftersignState = loadState();
let lastPersistedAt: string | null = null;
let dirty = false;

function createInitialState(): PersistedAftersignState {
  return {
    playerId: `player-${slot}`,
    sessionId: `session-${slot}-1`,
    beat: "packet-offered",
    flags: {},
    ioTrust: 0,
    ioMemory: [],
    revision: 0,
  };
}

function loadState(): PersistedAftersignState {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return createInitialState();

  const parsed = JSON.parse(raw) as PersistedAftersignState;
  return {
    ...parsed,
    sessionId: nextSessionId(parsed.sessionId),
  };
}

function nextSessionId(previous: string): string {
  const match = previous.match(/^(.*-)(\d+)$/);
  if (!match) return `${previous}-2`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

function packetOutcome(): "sealed" | "opened" | null {
  if (state.flags.packetSealed === true) return "sealed";
  if (state.flags.packetOpened === true) return "opened";
  return null;
}

function packetFactId(outcome: "sealed" | "opened"): string {
  return `io.packet.${outcome}`;
}

function ensurePacketMemory(): MemoryFact | null {
  const outcome = packetOutcome();
  if (!outcome) return null;

  const id = packetFactId(outcome);
  const existing = state.ioMemory.find((fact) => fact.id === id);
  if (existing) return existing;

  const fact: MemoryFact = {
    id,
    subject: "player",
    predicate: "delivered-blue-packet",
    object: outcome,
    sessionId: state.sessionId,
  };
  state.ioMemory = state.ioMemory.filter(
    (memory) => memory.predicate !== "delivered-blue-packet",
  );
  state.ioMemory.push(fact);
  return fact;
}

function recognitionLine(fact: MemoryFact | null): string | null {
  if (!fact) return null;
  if (fact.object === "sealed") {
    return "You came back. So did the blue seal, unbroken. That gives me two facts to trust.";
  }
  return "You came back. The seal did not. I can use one of those facts.";
}

function markDirty(): void {
  dirty = true;
  render();
}

async function choose(choiceId: ChoiceId): Promise<void> {
  if (choiceId === "open-packet") {
    state.flags.packetOpened = true;
    delete state.flags.packetSealed;
    state.beat = "packet-opened";
    state.ioTrust = -1;
  } else if (choiceId === "keep-packet-sealed") {
    state.flags.packetSealed = true;
    delete state.flags.packetOpened;
    state.beat = "packet-kept-sealed";
    state.ioTrust = 1;
  } else {
    ensurePacketMemory();
    state.flags.packetDelivered = true;
    state.beat = "packet-delivered";
  }

  markDirty();
}

async function advance(): Promise<void> {
  if (state.beat === "packet-delivered") {
    ensurePacketMemory();
    state.beat = "io-returning-recognition";
    markDirty();
    return;
  }

  if (state.beat === "arrival") {
    state.beat = "packet-offered";
    markDirty();
  }
}

async function forceSave(): Promise<void> {
  const saved: PersistedAftersignState = {
    ...state,
    ioMemory:
      breakMode === "drop-memory"
        ? []
        : state.ioMemory.map((fact) => ({ ...fact })),
    revision: state.revision + 1,
  };

  if (breakMode !== "skip-save") {
    window.localStorage.setItem(storageKey, JSON.stringify(saved));
    state = saved;
    dirty = false;
    lastPersistedAt = new Date().toISOString();
  }

  render();
}

async function forceReload(): Promise<void> {
  state = loadState();
  dirty = false;
  render();
}

function currentRecognitionFact(): MemoryFact | null {
  const outcome = packetOutcome();
  if (!outcome) return null;

  const expectedId =
    breakMode === "wrong-line-ref"
      ? packetFactId(outcome === "sealed" ? "opened" : "sealed")
      : packetFactId(outcome);
  return state.ioMemory.find((fact) => fact.id === expectedId) ?? null;
}

function buildSurface(): FlagshipTestSurface {
  const fact =
    state.beat === "io-returning-recognition" ? currentRecognitionFact() : null;

  return {
    version: 1,
    scene: {
      id: "io-kiosk",
      act: "the-seal",
      beat: state.beat,
    },
    player: {
      id: state.playerId,
      name: null,
      flags: { ...state.flags },
    },
    npcs: {
      io: {
        id: "io",
        displayName: "Io Vale",
        present: true,
        trust: state.ioTrust,
        memory: state.ioMemory.map((memory) => ({ ...memory })),
        lastLine: recognitionLine(fact),
        lastLineMemoryRefs: fact ? [fact.id] : [],
      },
    },
    save: {
      slot,
      revision: state.revision,
      lastPersistedAt,
      dirty,
    },
    input: {
      choose,
      advance,
      forceSave,
      forceReload,
    },
  };
}

function render(): void {
  window.__game = buildSurface();

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const line = window.__game.npcs.io.lastLine ?? "Io waits beside the blue seal.";
  root.innerHTML = `
    <main>
      <p class="eyebrow">AFTERSIGN / Io's Night Post</p>
      <h1>The Seal</h1>
      <p>${line}</p>
      <p data-testid="beat">${window.__game.scene.beat}</p>
    </main>
  `;
}

render();
