import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SeededPRNG } from '../src/generator/prng.js';

describe('SeededPRNG Determinism & Distributions Tests', () => {
  test('Guarantees 100% reproducible sequence given identical seeds', () => {
    const prng1 = new SeededPRNG(12345);
    const prng2 = new SeededPRNG(12345);

    const seq1 = Array.from({ length: 10 }, () => prng1.int(1, 1000));
    const seq2 = Array.from({ length: 10 }, () => prng2.int(1, 1000));

    assert.deepEqual(seq1, seq2);

    // UUID determinism
    assert.equal(prng1.uuid(), prng2.uuid());
    // NanoID determinism
    assert.equal(prng1.nanoid(), prng2.nanoid());
  });

  test('Produces different sequences on different seeds', () => {
    const prngA = new SeededPRNG(111);
    const prngB = new SeededPRNG(999);

    assert.notEqual(prngA.uuid(), prngB.uuid());
  });

  test('Zipfian distribution clusters higher probabilities on head indices', () => {
    const prng = new SeededPRNG(42);
    const n = 10;
    const counts = new Array(n).fill(0);

    for (let i = 0; i < 1000; i++) {
      const idx = prng.zipf(n, 1.2);
      counts[idx]++;
    }

    // Index 0 should have significantly more occurrences than Index 9 (80/20 power law)
    assert.ok(counts[0] > counts[9] * 3);
  });
});
