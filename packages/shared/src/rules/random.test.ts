import { describe, expect, it } from 'vitest';
import { SeededRandom } from './random';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect([a.nextUint32(), a.nextUint32()]).not.toEqual([b.nextUint32(), b.nextUint32()]);
  });

  it('keeps nextInt within range', () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('matches a known reference sequence', () => {
    const rng = new SeededRandom(1);
    expect([rng.nextUint32(), rng.nextUint32(), rng.nextUint32()]).toMatchInlineSnapshot(`
      [
        2693262067,
        11749833,
        2265367787,
      ]
    `);
  });
});
