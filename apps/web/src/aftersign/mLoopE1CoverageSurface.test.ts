import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servedMain = readFileSync(resolve(process.cwd(), 'aftersign/main.js'), 'utf8');

describe('M-LOOP E1 served coverage', () => {
  it('does not leave the player-visible loop behind an unset implementation flag', () => {
    expect(servedMain).not.toMatch(/M_LOOP_E1_IMPL_LANDED/);
  });
});
