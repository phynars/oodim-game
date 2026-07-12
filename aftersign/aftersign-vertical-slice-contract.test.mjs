import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

assert.match(html, /<script\b[\s\S]*window\.__game[\s\S]*<\/script>/, 'AFTERSIGN index.html publishes a harness-visible window.__game surface');
assert.match(html, /io-night-post-kiosk|io-night-post/, 'AFTERSIGN slice exposes Io night-post scene identity');
assert.match(html, /blue-packet/i, 'AFTERSIGN first playable beat includes the blue packet');
assert.match(html, /localStorage/, 'AFTERSIGN vertical slice persists local memory before durable server authority lands');
assert.match(html, /return-to-io|returning-recognition|startReturnSession/i, 'AFTERSIGN slice has a return-session memory beat');
