/**
 * Lightweight smoke checks for core game helpers (no browser).
 * Run: npm run smoke
 */
import assert from 'node:assert/strict';

function makeRng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const a = makeRng(42);
const b = makeRng(42);
for (let i = 0; i < 20; i++) assert.equal(a(), b());

const c = makeRng(7);
const d = makeRng(9);
assert.notEqual(c(), d());

function dailySeed(day) {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

assert.equal(dailySeed('2026-10-07'), dailySeed('2026-10-07'));
assert.notEqual(dailySeed('2026-10-07'), dailySeed('2026-10-08'));

console.log('smoke-game: ok');
