import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const indexHtml = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

assert.match(
  indexHtml,
  /<script\s+type="module"\s+src="\.\/main\.js"><\/script>/,
  'AFTERSIGN served page must load the playable slice from aftersign/main.js'
);

assert.match(
  mainSource,
  /addEventListener\((['"])(pointerup|click|touchend)\1/,
  'M-LOOP acceptance must stay player-playable: served-page progress is caused by a visible tap/click/touch handler, not only by window.__game input helpers'
);

assert.doesNotMatch(
  mainSource,
  /window\.__game\.input\.[A-Za-z0-9_$]+\s*\(/,
  'M-LOOP acceptance must not drive player actions through window.__game input helpers'
);

assert.match(
  mainSource,
  /io-return-recognition/,
  'served story still reaches the durable Io return-recognition beat before the loop continues'
);

assert.match(
  mainSource,
  /job|route|offer/i,
  'M-LOOP must expose the next round as a job/route offer on the served page, not stop at recognition dialogue'
);

console.log('AFTERSIGN M-LOOP served-page acceptance contract holds.');
