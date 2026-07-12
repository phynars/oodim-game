import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

function scriptSource() {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match, 'AFTERSIGN slice exposes a module script');
  return match[1];
}

function createHarness() {
  const listeners = new Map();
  const classNames = new Set(['packet']);
  const storage = new Map();
  const text = new Map([
    ['#ioLine', 'Io: “Blue packet. Sign box by the rail. Bring me back the fact, not the story.”'],
    ['#prompt', 'Tap the packet to deliver sealed. Hold 0.55s to break the wax first.']
  ]);

  class ElementStub {
    constructor(selector) {
      this.selector = selector;
      this.style = { setProperty: (key, value) => text.set(`${selector}:style:${key}`, value) };
      this.classList = {
        add: (...names) => names.forEach((name) => classNames.add(name)),
        remove: (...names) => names.forEach((name) => classNames.delete(name)),
        toggle: (name, force) => force ? classNames.add(name) : classNames.delete(name)
      };
    }

    get textContent() {
      return text.get(this.selector) ?? '';
    }

    set textContent(value) {
      text.set(this.selector, value);
    }

    addEventListener(type, handler) {
      listeners.set(`${this.selector}:${type}`, handler);
    }

    setPointerCapture() {}
    offsetWidth = 1;
  }

  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new ElementStub(selector));
      return elements.get(selector);
    }
  };

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  const context = {
    document,
    localStorage,
    navigator: {},
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    window: {}
  };

  const body = `${Object.keys(context).map((key) => `const ${key} = __ctx.${key};`).join('\n')}\n${scriptSource()}`;
  Function('__ctx', body)(context);
  return { ...context, listeners, classNames, storage, text };
}

{
  const { window } = createHarness();
  window.__game.choosePacketOutcome('sealed');
  window.__game.startReturnSession();
  const story = window.__game.storyState;
  assert.equal(story.packetOutcome, 'sealed');
  assert.equal(story.ioTrustPosture, 'trusting');
  assert.equal(story.authoredMemory, 'The player delivered the blue packet unopened.');
  assert.match(story.lastIoLine, /blue seal, unbroken/);
}

{
  const { window } = createHarness();
  window.__game.choosePacketOutcome('opened');
  window.__game.startReturnSession();
  const story = window.__game.storyState;
  assert.equal(story.packetOutcome, 'opened');
  assert.equal(story.ioTrustPosture, 'wary');
  assert.equal(story.authoredMemory, 'The player opened the blue packet before delivery.');
  assert.match(story.lastIoLine, /The seal did not/);
}

{
  const { window } = createHarness();
  assert.equal(window.__game.inputState.holdToOpenMs, 550);
}
